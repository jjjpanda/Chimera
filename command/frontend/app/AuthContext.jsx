import { createContext, useContext } from "react"
const AuthContext = createContext({ role: null })
export const useRole = () => useContext(AuthContext).role
export default AuthContext
