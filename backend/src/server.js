require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`TaskPay backend listening on http://localhost:${PORT}`);
});
