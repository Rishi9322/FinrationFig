// Seeds (or repairs) the single SUPER_ADMIN in Supabase Auth.
//
// Run once after applying the migrations, and any time you need to reset the
// admin. It is idempotent: it creates the auth user if missing, otherwise
// resets the password, then forces the profile to SUPER_ADMIN / FULL access.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME="FinRatio Admin" \
//   node scripts/seed-admin.mjs
//
// The service role key bypasses RLS — never expose it to the browser.

import { createClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD || ""
const name = process.env.ADMIN_NAME || "FinRatio Admin"

if (!url || !serviceKey || !email || !password) {
  console.error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL or ADMIN_PASSWORD")
  process.exit(1)
}

const strong =
  password.length >= 10 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password)
if (!strong) {
  console.error("ADMIN_PASSWORD must be 10+ chars with upper/lower/number/symbol")
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findUserByEmail(target) {
  // Paginate the admin user list until we find the address (small deployments).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => (u.email || "").toLowerCase() === target)
    if (match) return match
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  let user = await findUserByEmail(email)

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw error
    user = data.user
    console.log(`Created auth user ${email}`)
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw error
    console.log(`Updated existing auth user ${email}`)
  }

  // The insert trigger may not have run yet for a brand-new user; upsert to be safe.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      name,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      calculator_access_mode: "FULL",
    },
    { onConflict: "id" },
  )
  if (profileError) throw profileError

  console.log(`Super-admin ready: ${email}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
