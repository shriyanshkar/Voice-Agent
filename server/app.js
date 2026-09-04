const express = require('express');
const cors = require('cors');
// Import all the tools we just built
const { parseOrderTranscript, writeKitchenDocket, writeBookingDocket } = require('./parser'); 

const app = express();
const duplicateOrderCache = new Map();
const DUPLICATE_ORDER_WINDOW_MS = 10000;

app.use(cors()); 
app.use(express.json()); 

function normalizeTranscript(transcript) {
  return String(transcript || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function clearDuplicateOrder(key) {
  setTimeout(() => duplicateOrderCache.delete(key), DUPLICATE_ORDER_WINDOW_MS);
}

app.post('/order', async (req, res) => {
  try {
    const { transcript } = req.body;
    const normalizedTranscript = normalizeTranscript(transcript);

    if (!normalizedTranscript) {
      return res.status(400).json({
        success: false,
        message: "Transcript is required."
      });
    }

    console.log(`Incoming transcript: "${transcript}"`);

    const existingOrder = duplicateOrderCache.get(normalizedTranscript);
    if (existingOrder) {
      const existingResult = await existingOrder;
      console.log(`[Order] Duplicate transcript ignored: "${normalizedTranscript}"`);
      return res.status(existingResult.status).json({
        ...existingResult.body,
        duplicate: true,
        message: existingResult.body.success ? "Duplicate order ignored." : existingResult.body.message
      });
    }
    
    const orderPromise = (async () => {
      // 1. Send the text to Gemini
      const parsedData = await parseOrderTranscript(normalizedTranscript);
    
      // 2. Catch random gibberish
      if (parsedData.intent === 'invalid') {
        return {
          status: 400,
          body: {
            success: false,
            message: parsedData.error_message || "I didn't understand that request."
          }
        };
      }

      // 3. Route to Front Desk
      if (parsedData.intent === 'table_booking') {
        await writeBookingDocket(parsedData.booking_details);
        return {
          status: 200,
          body: { success: true, message: "Table booked successfully!" }
        };
      }

      // 4. Route to Kitchen
      if (parsedData.intent === 'food_order') {
        await writeKitchenDocket(parsedData.order_details.items);
        return {
          status: 200,
          body: { success: true, message: "Order sent to kitchen!" }
        };
      }

      return {
        status: 400,
        body: { success: false, message: "I didn't understand that request." }
      };
    })();

    duplicateOrderCache.set(normalizedTranscript, orderPromise);
    clearDuplicateOrder(normalizedTranscript);

    const result = await orderPromise;
    return res.status(result.status).json(result.body);

  } catch (error) {
    console.error("Backend crash:", error); // This logs the actual error to your terminal!
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = app;
