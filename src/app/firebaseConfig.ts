import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDIf7YnaJsLgBGb-MPVraQF4sav9xRLlhU",
  authDomain: "nextpodcast-2288f.firebaseapp.com",
  projectId: "nextpodcast-2288f",
  storageBucket: "nextpodcast-2288f.appspot.com",
  messagingSenderId: "695337811076",
  appId: "1:695337811076:web:839f369c6c1658969c16d1",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
