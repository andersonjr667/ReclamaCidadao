const { exec } = require('child_process');

// Porta do seu servidor Express
const PORT = process.env.PORT || 5000;

// Subdomínio desejado
const SUBDOMAIN = "reclamacidadao";

// Comando SSH Serveo (com subdomínio fixo)
const sshCmd = `ssh -o StrictHostKeyChecking=no -R ${SUBDOMAIN}.serveo.net:80:localhost:${PORT} serveo.net`;

const tunnel = exec(sshCmd);

let linkEncontrado = false;

tunnel.stdout.on('data', (data) => {
  process.stdout.write(data);

  // Captura qualquer link retornado pelo Serveo
  const match = data.match(/Forwarding HTTP traffic from (https?:\/\/[^\s]+)/);
  if (match && !linkEncontrado) {
    linkEncontrado = true;
    console.log(`🌍 Link público: ${match[1]}`);
    
    // Se o link NÃO for o que você queria, avisa
    if (!match[1].includes(SUBDOMAIN)) {
      console.log(`⚠️ O subdomínio "${SUBDOMAIN}" já está em uso. Foi gerado um link aleatório.`);
    }
  }
});

tunnel.stderr.on('data', (data) => {
  process.stderr.write(data);
});

tunnel.on('close', (code) => {
  console.log(`❌ Túnel SSH finalizado (código ${code})`);
});
