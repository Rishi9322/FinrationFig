import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"

// Firebase web config is public by design — it ships in the client bundle and is
// safe to commit. Access is controlled by Firebase Auth rules + Supabase RLS,
// not by hiding these values.
const firebaseConfig = {
  apiKey: "AIzaSyAHaDW4hmGF7F2pfBd6enUptGwgpQgTlhg",
  authDomain: "finratio-1245e.firebaseapp.com",
  projectId: "finratio-1245e",
  storageBucket: "finratio-1245e.firebasestorage.app",
  messagingSenderId: "476659939444",
  appId: "1:476659939444:web:f53d939cdca31329dab921",
  measurementId: "G-5H32FCRMFL",
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const googleProvider = new GoogleAuthProvider()

// The Firebase project id doubles as the Supabase third-party-auth audience and
// the JWT issuer suffix (https://securetoken.google.com/<projectId>).
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId
