import { createContext, useContext } from "react"
const AuthContext = createContext({ role: null, signOut: () => {}, changePassword: () => {} })
export const useRole = () => useContext(AuthContext).role
export const useSignOut = () => useContext(AuthContext).signOut
export const useChangePassword = () => useContext(AuthContext).changePassword
export default AuthContext
