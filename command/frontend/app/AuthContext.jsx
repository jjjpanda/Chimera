import { createContext, useContext } from "react"
const AuthContext = createContext({ role: null, signOut: () => {} })
export const useRole = () => useContext(AuthContext).role
export const useSignOut = () => useContext(AuthContext).signOut
export default AuthContext
