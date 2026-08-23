# Menu Parser AI

A web application that converts restaurant menu PDFs into structured JSON format using Google's Gemini AI API.

## Overview

This project provides a simple, user-friendly interface to upload PDF menu files and automatically extract menu items into a clean, structured JSON format. It uses Express.js for the backend server and Gemini 2.5 Flash for AI-powered PDF parsing.

## Features

- **PDF Upload Interface**: Clean HTML interface for uploading PDF menu files
- **AI-Powered Parsing**: Uses Google Generative AI (Gemini 2.5 Flash) to intelligently extract menu items
- **JSON Output**: Automatically generates structured JSON from parsed menu data
- **File Download**: Download parsed menu data as JSON files
- **In-Memory Processing**: Files are stored in RAM for quick processing without disk overhead
- **Error Handling**: Robust error handling for parsing failures and file issues

## Project Structure

```
├── server.js          # Express server entry point
├── app.js             # Express app configuration and routes
├── parser.js          # PDF parsing logic using Gemini AI
├── index.html         # Frontend upload interface
├── package.json       # Project dependencies and scripts
├── api.env            # Environment variables (API keys)
├── output.json        # Generated parsed menu output
└── parser.test.js     # Test suite (Jest)
```

## Technology Stack

- **Backend**: Node.js with Express.js
- **File Handling**: Multer for file uploads
- **AI Engine**: Google Generative AI (Gemini 2.5 Flash)
- **Testing**: Jest with Supertest
- **Development**: Nodemon for auto-reload

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create an `api.env` file with your Gemini API key:
```
GEMINI_API_KEY=your_api_key_here
PORT=3000
```

3. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Running Tests
```bash
npm test
npm run test:watch
```

The server will start on `http://localhost:3000`

## API Endpoints

### GET `/`
Serves the main upload interface (index.html)

### POST `/upload-menu`
Uploads and parses a menu PDF file.

**Request:**
- Method: POST
- Body: FormData with 'menu' file field (PDF)
- Content-Type: multipart/form-data

**Response:**
```json
{
  "items": [
    {
      "name": "Item Name",
      "description": "Item description",
      "price": "9.99"
    }
  ]
}
```

### GET `/download-json`
Downloads the last parsed menu as `parsed_menu.json`

## How It Works

1. **Upload**: User selects a PDF menu file through the web interface
2. **Server Processing**: Express server receives the file via Multer and stores it in memory
3. **AI Parsing**: The PDF buffer is sent to Gemini 2.5 Flash for intelligent menu extraction
4. **JSON Conversion**: AI response is parsed and cleaned (removes markdown formatting)
5. **Storage**: Parsed data is written to `output.json`
6. **Display**: JSON is returned to frontend and displayed to user

## Key Implementation Details

- **Memory Storage**: Uses `multer.memoryStorage()` for efficient temporary file handling
- **AI Model**: Gemini 2.5 Flash (chosen for reliability on PDF parsing tasks)
- **JSON Cleaning**: Automatically removes markdown code blocks from AI responses (`\`\`\`json`, `\`\`\``)
- **Error Recovery**: Comprehensive error handling for parsing failures and validation

## Dependencies

- `express` - Web server framework
- `@google/generative-ai` - Google AI API client
- `multer` - File upload middleware
- `dotenv` - Environment variable management
- `jest` - Testing framework
- `nodemon` - Development auto-reload
- `supertest` - HTTP assertion library for tests

## Development

- Uses Nodemon for automatic server restart during development
- Jest testing framework for unit and integration tests
- Supertest for API endpoint testing
