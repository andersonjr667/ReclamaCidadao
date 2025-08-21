const { exec } = require('child_process');

// Porta do seu servidor Express
const PORT = process.env.PORT || 5000;

// Comando SSH Serveo
const sshCmd = `ssh -o StrictHostKeyChecking=no -R reclamacidadao:80:localhost:${PORT} serveo.net`;

const tunnel = exec(sshCmd);

tunnel.stdout.on('data', (data) => {
  process.stdout.write(data);
  // Captura e mostra o link público
  const match = data.match(/Forwarding HTTP traffic from (https?:\/\/[^\s]+)/);
  if (match) {
    console.log('Link público:', match[1]);
  }
});

tunnel.stderr.on('data', (data) => {
  process.stderr.write(data);
});

tunnel.on('close', (code) => {
  console.log(`Túnel SSH finalizado (código ${code})`);
});
