import { db, auth } from "./firebase.js";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDocs,
  limit,
  setDoc
} from "firebase/firestore";

/**
 * Initializes or retrieves a unique chat document for two participants.
 * Uses a deterministic ID based on sorted UIDs.
 */
export async function getOrCreateChat(partnerId) {
  const me = auth.currentUser;
  if (!me) throw new Error("Unauthorized");

  const participants = [me.uid, partnerId].sort();
  const chatId = participants.join("_");
  const chatRef = doc(db, "chats", chatId);

  // Check if it exists
  const chatSnap = await getDocs(query(collection(db, "chats"), where("__name__", "==", chatId)));
  
  if (chatSnap.empty) {
    // Fetch partner details for the chat metadata
    const partnerSnap = await getDocs(query(collection(db, "users"), where("__name__", "==", partnerId)));
    const partnerData = partnerSnap.docs[0]?.data() || {};

    await setDoc(chatRef, {
      participants,
      participantDetails: {
        [me.uid]: { name: me.displayName || "User" },
        [partnerId]: { name: partnerData.name || "Anonymous Entity" }
      },
      updatedAt: serverTimestamp(),
      lastMessage: { text: "Neural Link Established", senderId: "system", timestamp: serverTimestamp() }
    });
  }

  return chatId;
}

/**
 * Sends a message within a specific chat.
 */
export async function sendMessage(chatId, text) {
  const me = auth.currentUser;
  if (!me) return;

  const chatRef = doc(db, "chats", chatId);
  const messagesRef = collection(chatRef, "messages");

  // 1. Add Message
  await addDoc(messagesRef, {
    senderId: me.uid,
    text,
    timestamp: serverTimestamp()
  });

  // 2. Update Chat Metadata
  await updateDoc(chatRef, {
    lastMessage: { text, senderId: me.uid, timestamp: serverTimestamp() },
    updatedAt: serverTimestamp()
  });
}

/**
 * Listens to all active conversations for the current user.
 */
export function listenToConversations(callback) {
  const me = auth.currentUser;
  if (!me) return () => {};

  const q = query(
    collection(db, "chats"),
    where("participants", "array-contains", me.uid),
    orderBy("updatedAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(chats);
  });
}

/**
 * Listens to messages inside a specific chat.
 */
export function listenToMessages(chatId, callback) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("timestamp", "asc"),
    limit(100)
  );

  return onSnapshot(q, (snap) => {
    const messages = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(messages);
  });
}
