// Test-only loader: replaces the Firebase CDN modules with no-op stubs so app modules import in Node.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(s, c, next) { if (s.startsWith("https:")) return { url: s, shortCircuit: true }; return next(s, c); }
export async function load(u, c, next) {
  if (u.startsWith("https:")) {
    const f = "()=>({})";
    return { format: "module", shortCircuit: true, source: "const f=" + f + "; export const initializeApp=f,getDatabase=f,ref=f,onValue=f,set=f,getAuth=f,GoogleAuthProvider=class{},signInWithPopup=f,signInWithRedirect=f,getRedirectResult=f,onAuthStateChanged=f,signOut=f;" };
  }
  return next(u, c);
}`));
