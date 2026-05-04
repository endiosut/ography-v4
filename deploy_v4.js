const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const base = 'C:/Users/Endi Osut/ography-v4';
const teamId = 'team_13jt67FRZuxmI61XguOarC2s';

// Step 1: Create .vercel directory with project config
// This tells vercel CLI which team/project to deploy to
// We'll let vercel create the project fresh on first deploy

// Step 2: Create a vercel.json to configure the project
const vercelJson = {
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
};

fs.writeFileSync(
  path.join(base.replace('C:/', 'C:\\').replace(/\//g, '\\'), 'vercel.json'),
  JSON.stringify(vercelJson, null, 2),
  'utf8'
);
console.log('✓ vercel.json created');

// Step 3: Create .env.production with all env vars for Vercel
const envContent = `NEXT_PUBLIC_SUPABASE_URL=https://unzwefrtgsgmtljlbavf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MTM1MjMsImV4cCI6MjA5MjA4OTUyM30.QPoyf_UYDD82xW1KYaSbukPrfMoTAACVMKPT05HKI90
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuendlZnJ0Z3NnbXRsamxiYXZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUxMzUyMywiZXhwIjoyMDkyMDg5NTIzfQ.3Eg8BjGIwW6eiDZsUDe3liCwkugYLcYK6u-hSC3AsEg
`;

// Don't overwrite .env.local — create .env.production.local for production builds
const envProdPath = path.join(base.replace('C:/', 'C:\\').replace(/\//g, '\\'), '.env.production.local');
if (!fs.existsSync(envProdPath)) {
  fs.writeFileSync(envProdPath, envContent, 'utf8');
  console.log('✓ .env.production.local created');
} else {
  console.log('✓ .env.production.local already exists');
}

console.log('\nReady to deploy. Run this command:');
console.log('cd "C:\\Users\\Endi Osut\\ography-v4"');
console.log('vercel --prod --yes --team team_13jt67FRZuxmI61XguOarC2s');
console.log('\nWhen prompted for project name, type: ography-v4');
