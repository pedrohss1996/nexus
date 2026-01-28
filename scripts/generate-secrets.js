const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Gerar secrets aleatórios
const jwtSecret = crypto.randomBytes(32).toString('hex');
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('🔐 Secrets gerados com sucesso!');
console.log('\n📋 Adicione estas linhas ao seu arquivo .env:\n');
console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`SESSION_SECRET=${sessionSecret}`);
console.log('\n⚠️  IMPORTANTE: Mantenha estes secrets em segurança!');

// Tentar atualizar o .env automaticamente (se existir)
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Substituir JWT_SECRET se existir
  if (envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace(
      /JWT_SECRET=.*/,
      `JWT_SECRET=${jwtSecret}`
    );
  } else {
    envContent += `\nJWT_SECRET=${jwtSecret}\n`;
  }
  
  // Substituir SESSION_SECRET se existir
  if (envContent.includes('SESSION_SECRET=')) {
    envContent = envContent.replace(
      /SESSION_SECRET=.*/,
      `SESSION_SECRET=${sessionSecret}`
    );
  } else {
    envContent += `SESSION_SECRET=${sessionSecret}\n`;
  }
  
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('\n✅ Arquivo .env atualizado automaticamente!');
} else {
  console.log('\n⚠️  Arquivo .env não encontrado. Crie-o manualmente a partir do env.template');
}
