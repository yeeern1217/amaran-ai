"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  GoogleAuthProvider,
  type User,
} from "firebase/auth"
import { auth } from "@/lib/firebase"

interface AuthState {
  user: User | null
  loading: boolean
  idToken: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u: User | null) => {
      setUser(u)
      if (u) {
        const token = await u.getIdToken()
        setIdToken(token)
      } else {
        setIdToken(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Refresh token every 50 minutes (tokens expire after 60)
  useEffect(() => {
    if (!user) return
    const interval = setInterval(async () => {
      const token = await user.getIdToken(true)
      setIdToken(token)
    }, 50 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
  }

  async function signOut() {
    await fbSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, idToken, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}
