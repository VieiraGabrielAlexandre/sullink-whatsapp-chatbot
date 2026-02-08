require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();
app.use(express.json());

app.use('/webhook', webhookRouter);

app.get('/status', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Aplicação está funcionando' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
