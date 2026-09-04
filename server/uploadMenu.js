require('dotenv').config({ path: './api.env' });
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function uploadMenuToDB() {
  try {
    console.log("Connecting to Postgres...");
    
    // 1. Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100),
        name VARCHAR(100) UNIQUE,
        price VARCHAR(20),
        description TEXT
      );
    `);
    
    // 2. Clear out the old menu to prevent duplicates
    await pool.query('DELETE FROM menu_items');

    // 3. Read your parsed JSON file
    const rawData = fs.readFileSync('./menu.json', 'utf8');
    const menuData = JSON.parse(rawData);

    console.log("Uploading items to database...");

    // 4. Loop through the JSON and insert items
    for (const section of menuData.menu) {
      const category = section.section;
      
      // Standard sections (like BAR SNACKS)
      if (section.items) {
        for (const item of section.items) {
           await insertItem(category, item);
        }
      } 
      // Deeply nested sections (like DINNER MENU -> STARTERS)
      else if (section.subsections) {
        for (const sub of section.subsections) {
          for (const item of sub.items) {
             await insertItem(category, item);
          }
        }
      }
    }
    
    console.log("✅ Menu successfully uploaded from JSON to Postgres!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error uploading menu:", err);
    process.exit(1);
  }
}

// Helper function to safely insert data
async function insertItem(category, item) {
    const query = `
      INSERT INTO menu_items (category, name, price, description) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING;
    `;
    // Map missing descriptions or prices to empty strings
    const values = [category, item.name, item.price || '', item.description || ''];
    await pool.query(query, values);
}

uploadMenuToDB();
