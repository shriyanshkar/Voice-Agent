const express = require('express');
const cors = require('cors');
// Import all the tools we just built
const { parseOrderTranscript, writeKitchenDocket, writeBookingDocket } = require('./parser'); 

const app = express();

app.use(cors()); 
app.use(express.json()); 

app.post('/order', async (req, res) => {
  try {
    const { transcript } = req.body;
    console.log(`Incoming transcript: "${transcript}"`);
    
    // 1. Send the text to Gemini
    const parsedData = await parseOrderTranscript(transcript);
    
    // 2. Catch random gibberish
    if (parsedData.intent === 'invalid') {
      return res.status(400).json({ 
        success: false, 
        message: parsedData.error_message || "I didn't understand that request." 
      });
    }

    // 3. Route to Front Desk
    if (parsedData.intent === 'table_booking') {
      writeBookingDocket(parsedData.booking_details);
      return res.status(200).json({ success: true, message: "Table booked successfully!" });
    }

    // 4. Route to Kitchen
    if (parsedData.intent === 'food_order') {
      writeKitchenDocket(parsedData.order_details.items);
      return res.status(200).json({ success: true, message: "Order sent to kitchen!" });
    }

  } catch (error) {
    console.error("Backend crash:", error); // This logs the actual error to your terminal!
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;