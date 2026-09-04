require('dotenv').config({ path: './api.env' });
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(` Server ignited on http://localhost:${PORT}`);
});
