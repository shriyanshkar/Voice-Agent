// We don't need 'fs' anymore!
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

  // Loop through items and print modifications underneath
  itemsToPrint.forEach(item => {
    content += `[ ${item.quantity || 1}x ] - ${item.name || 'Unknown Item'}\n`;
    
    // If modifications exist, loop through them and indent them
    if (item.modifications && item.modifications.length > 0) {
      item.modifications.forEach(mod => {
        content += `      -> ${mod.toUpperCase()}\n`; // Caps lock for the kitchen!
      });
    }
  });
  
  content += "\n============================\n";
  fs.writeFileSync(filepath, content);
  console.log(`✅ [Printer] Kitchen docket printed to: dockets/${filename}`);
}

async function writeBookingDocket(bookingDetails) {
  const docketsDir = path.join(__dirname, 'dockets');
  if (!fs.existsSync(docketsDir)) fs.mkdirSync(docketsDir);
  
  const filename = `front_desk_${Date.now()}.txt`;
  const filepath = path.join(docketsDir, filename);
  
  let content = "=== CYGEN FRONT DESK BOOKING ===\n";
  content += `Time Received: ${new Date().toLocaleTimeString()}\n\n`;
  
  // Bulletproof fallback logic
  const details = bookingDetails || {};
  
  content += `Name: ${details.name || 'Walk-in / Not Provided'}\n`;
  content += `Party Size: ${details.party_size || 1}\n`;
  content += `Date: ${details.date || 'Today'}\n`;
  content += `Time: ${details.time || 'ASAP'}\n`;
  
  content += "\n================================\n";
  fs.writeFileSync(filepath, content);
  console.log(`✅ [Printer] Booking docket printed to: dockets/${filename}`);
}

// 2. Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function parseOrderTranscript(transcript) {
  try {
    console.log(`[Parser] Processing transcript: "${transcript}"`);
    console.log("[Parser] Fetching live menu from Neon Postgres...");
    
    // 3. Fetch the LIVE menu from the database
    const dbResponse = await pool.query('SELECT category, name, price, description FROM menu_items');
    const liveMenu = dbResponse.rows; 
    
    // 4. Setup the Gemini Model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // 5. Construct the strict prompt
    const prompt = `
      You are an automated restaurant parsing engine for Cygen. 
      
      Here is the LIVE DATABASE MENU: 
      ${JSON.stringify(liveMenu)}
      
      Analyze this transcript: "${transcript}"
      
      RULES:
      1. Determine the user's intent: "food_order", "table_booking", or "invalid".
      2. IF FOOD ORDER: Cross-reference their requested items with the "name" fields in the LIVE DATABASE MENU. Allow for fuzzy matching. If they order an item NOT in the database, set intent to "invalid" and explain the item is unavailable.
      3. IF TABLE BOOKING: Extract the customer's name, party size, date, and time from the transcript. If a specific detail is not mentioned, set that field to null.
      4. IF MODIFICATIONS: If the user asks for changes to an item (e.g., "extra onions", "no mayo", "allergy to nuts"), add them as strings to the "modifications" array for that specific item.
      
      You must reply ONLY with a valid JSON object matching this exact schema:
      {
        "intent": "food_order" | "table_booking" | "invalid",
        "order_details": {
          "items": [ 
            { 
              "name": "Exact_Menu_Item_Name", 
              "quantity": 1,
              "modifications": ["extra onions", "no tomato"] 
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