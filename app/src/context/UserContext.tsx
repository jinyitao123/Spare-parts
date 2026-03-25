import { createContext, useContext, useState, type ReactNode } from 'react'
import type { UserRole, UserProfile } from '../types/user'

const users: Record<UserRole, UserProfile> = {
  section_leader:   { name: '王段长', role: 'section_leader',   roleName: '工段长',     avatar: '王' },
  engineer:         { name: '张工',   role: 'engineer',         roleName: '设备工程师', avatar: '张' },
  warehouse_keeper: { name: '李管',   role: 'warehouse_keeper', roleName: '库管员',     avatar: '李' },
  manager:          { name: '陈总',   role: 'manager',          roleName: '管理层',     avatar: '陈' },
}

interface UserContextValue {
  user: UserProfile
  switchRole: (role: UserRole) => void
  allUsers: Record<UserRole, UserProfile>
}

const UserContext = createContext<UserContextValue>(null!)

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('section_leader')

  return (
    <UserContext.Provider value={{
      user: users[role],
      switchRole: setRole,
      allUsers: users,
    }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
