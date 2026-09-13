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

// Step 3: Create .env.production.local for production builds.
//
// SECURITY (09 Sep 2026): this block used to contain the anon key AND the
// service_role key as literals. The service_role key bypasses every RLS policy
// in the project, and this file is tracked in git — so the credential was in
// origin/main from the initial commit, readable by every repo collaborator.
// That directly contradicted the written rule in ENDI-DO-THIS-FIRST.md
// ("Do not give Dueng the service_role key. Ever.").
//
// Secrets now come from the environment of whoever runs this script. Nothing
// is written to disk that was not already in the operator's own shell.
const REQUIRED = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('✗ Missing required environment variables: ' + missing.join(', '));
  console.error('  Export them in your shell (or pull with `vercel env pull`) and re-run.');
  console.error('  Never paste a service_role key into this file.');
  process.exit(1);
}
const envContent = REQUIRED.map((k) => `${k}=${process.env[k]}`).join('\n') + '\n';

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
