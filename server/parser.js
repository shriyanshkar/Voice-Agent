// We don't need 'fs' anymore!
require('dotenv').config({ path: './api.env' });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
// 1. Initialize the Postgres connection pool
// (It automatically reads process.env.DATABASE_URL because your server.js loaded the api.env file)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function writeKitchenDocket(orderDetails) {
  const docketsDir = path.join(__dirname, 'dockets');
  if (!fs.existsSync(docketsDir)) fs.mkdirSync(docketsDir);
  
  const filename = `kitchen_order_${Date.now()}.txt`;
  const filepath = path.join(docketsDir, filename);
  
  let content = "=== CYGEN KITCHEN DOCKET ===\n";
  content += `Time: ${new Date().toLocaleTimeString()}\n\n`;
  
  let itemsToPrint = [];
  
  if (Array.isArray(orderDetails)) {
    itemsToPrint = orderDetails; 
  } else if (orderDetails && Array.isArray(orderDetails.items)) {
    itemsToPrint = orderDetails.items; 
  }

  // Loop through items and update safely
  for (const item of itemsToPrint) {
    const qty = item.quantity || 1;
    const itemName = item.name || 'Unknown Item';
    
    if (itemName !== 'Unknown Item') {
      // THE GUARDRAIL: Only update if current stock is greater than or equal to requested quantity
      const updateQuery = 'UPDATE menu_items SET stock = stock - $1 WHERE name = $2 AND stock >= $1 RETURNING *';
      const result = await pool.query(updateQuery, [qty, itemName]);
      
      // If rowCount is 0, the database rejected the update (stock was too low)
      if (result.rowCount === 0) {
        console.log(`❌ OUT OF STOCK GUARD: Prevented negative stock for ${itemName}`);
        content += `[ ❌ REJECTED ] - ${qty}x ${itemName} (INSUFFICIENT STOCK)\n`;
        continue; // Skip the rest of the loop so it doesn't print the normal ticket line
      }
      
      console.log(`📉 Stock decremented for ${itemName} by ${qty}`);
    }

    // Only prints if the database update was successful
    content += `[ ${qty}x ] - ${itemName}\n`;
    
    if (item.modifications && item.modifications.length > 0) {
      item.modifications.forEach(mod => {
        content += `      -> ${mod.toUpperCase()}\n`;
      });
    }
  }
  
  content += "\n============================\n";
  fs.writeFileSync(filepath, content);
  console.log(`✅ [Printer] Kitchen docket printed to: dockets/${filename}`);
}
  // ------------------------------------------------
  

async function writeBookingDocket(bookingDetails) {
  const docketsDir = path.join(__dirname, 'dockets');
  if (!fs.existsSync(docketsDir)) fs.mkdirSync(docketsDir);
  
  const timestamp = Date.now();
  const details = bookingDetails || {};
  
  // Make sure we actually have a date and time to check
  if (!details.date || !details.time) {
    console.log("❌ Missing date or time for booking.");
    return;
  }

  // 1. Check capacity for this exact time slot
  // We are assuming a maximum capacity of 10 tables per time slot
  const MAX_TABLES = 10; 
  const checkQuery = `SELECT COUNT(*) FROM reservations WHERE reservation_date = $1 AND reservation_time = $2`;
  const result = await pool.query(checkQuery, [details.date, details.time]);
  const currentBookings = parseInt(result.rows[0].count);

  let content = "=== CYGEN FRONT DESK ===\n";
  content += `Time Received: ${new Date().toLocaleTimeString()}\n\n`;

  if (currentBookings >= MAX_TABLES) {
    // 2A. REJECT THE BOOKING (CAPACITY REACHED)
    const filename = `REJECTED_booking_${timestamp}.txt`;
    
    content += `STATUS: ❌ REJECTED (FULLY BOOKED)\n`;
    content += `Requested Time: ${details.date} @ ${details.time}\n`;
    content += `Name: ${details.name || 'Walk-in'}\n`;
    content += `Party Size: ${details.party_size || 1}\n\n`;
    content += `Action Required: Please inform the customer we are at full capacity (${currentBookings}/${MAX_TABLES} tables booked) for this time slot.\n`;
    
    fs.writeFileSync(path.join(docketsDir, filename), content);
    console.log(`❌ [Printer] Rejected booking docket printed: dockets/${filename}`);

  } else {
    // 2B. ACCEPT THE BOOKING (CAPACITY AVAILABLE)
    const filename = `CONFIRMED_booking_${timestamp}.txt`;
    
    // Save to Postgres
    const insertQuery = `INSERT INTO reservations (customer_name, party_size, reservation_date, reservation_time) VALUES ($1, $2, $3, $4)`;
    await pool.query(insertQuery, [details.name, details.party_size, details.date, details.time]);
    
    content += `STATUS: ✅ CONFIRMED\n`;
    content += `Name: ${details.name || 'Walk-in'}\n`;
    content += `Party Size: ${details.party_size || 1}\n`;
    content += `Date: ${details.date}\n`;
    content += `Time: ${details.time}\n\n`;
    content += `Database Status: Saved to Neon. (${currentBookings + 1}/${MAX_TABLES} tables booked for this slot).\n`;
    
    fs.writeFileSync(path.join(docketsDir, filename), content);
    console.log(`✅ [Printer] Confirmed booking docket printed: dockets/${filename}`);
  }
}

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function parseOrderTranscript(transcript) {
  try {
    console.log(`[Parser] Processing transcript: "${transcript}"`);
    console.log("[Parser] Fetching live menu from Neon Postgres...");
    
    // 3. Fetch the LIVE menu from the database
    const dbResponse = await pool.query('SELECT category, name, price, description, stock FROM menu_items');
    const liveMenu = dbResponse.rows; 
    // 4. Setup the Gemini Model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
    // Grab the exact date right now (e.g., "2026-08-06")
    const todayStr = new Date().toISOString().split('T')[0];

    // 5. Construct the strict prompt
  
    // 2. Update the prompt to include the stock check rule
    const prompt = `
      You are an automated restaurant parsing engine for Cygen. 
      
      Here is the LIVE DATABASE MENU WITH CURRENT STOCK LEVELS: 
      ${JSON.stringify(liveMenu)}
      
      Analyze this transcript: "${transcript}"
      
      RULES:
      1. Determine the user's intent: "food_order", "table_booking", or "invalid".
      2. IF FOOD ORDER: Cross-reference their requested items with the "name" fields in the LIVE MENU. 
         -> STOCK CHECK: You must check the requested quantity against the available "stock" for that item. 
         -> If the user asks for an item with 0 stock, or asks for more than the available stock, you MUST set the intent to "invalid" and write an error_message saying "Item not in stock" or "Not enough stock available."
      3. IF TABLE BOOKING: Extract the customer's name, party size, date, and time. 
         -> CRITICAL CONTEXT: Today's date is ${todayStr}. If the user does not explicitly state a date, you MUST default the "date" field to "${todayStr}".
         -> TIME FORMAT: The "time" field MUST be strictly formatted in 24-hour time (e.g., "19:00:00"). Never include "a.m." or "p.m.".
      4. IF MODIFICATIONS: Add them as strings to the "modifications" array for that specific item.
      
      You must reply ONLY with a valid JSON object matching this exact schema:
      {
        "intent": "food_order" | "table_booking" | "invalid",
        "order_details": {
          "items": [ 
            { 
              "name": "Exact_Menu_Item_Name", 
              "quantity": 1,
              "modifications": [] 
            } 
          ]
        } | null,
        "booking_details": {
          "name": "string or null",
          "party_size": number or null,
          "time": "string or null",
          "date": "string or null"
        } | null,
        "error_message": "String explaining the issue" | null
      }
    `;
    console.log("[Parser] Sending data to Gemini AI...");
    
    // 6. Send to Gemini and get the response
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // 7. Clean and parse the JSON output
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanJson);
    
    console.log("[Parser] Successfully mapped intent:", parsedData.intent);
    console.log("[Parser] Full Gemini Output:\n", JSON.stringify(parsedData, null, 2));
    return parsedData;
    
  } catch (error) {
    console.error("❌ Error in parseOrderTranscript:", error);
    throw new Error("Failed to process the transcript");
  }
}

module.exports = { parseOrderTranscript, writeKitchenDocket, writeBookingDocket };