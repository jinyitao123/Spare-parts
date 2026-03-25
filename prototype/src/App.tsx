import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { UserRole } from './data/mockData'
import { users } from './data/mockData'
import Layout from './components/Layout'
import DashboardLeader from './pages/DashboardLeader'
import DashboardEngineer from './pages/DashboardEngineer'
import Warehouse from './pages/Warehouse'
import PartsCatalog from './pages/PartsCatalog'
import Procurement from './pages/Procurement'
import StaleInventory from './pages/StaleInventory'
import Kanban from './pages/Kanban'

function App() {
  const [role, setRole] = useState<UserRole>('section_leader')
  const user = users[role]

  return (
    <BrowserRouter>
      <Layout user={user} onRoleChange={setRole}>
        <Routes>
          <Route path="/" element={
            role === 'engineer' ? <DashboardEngineer /> :
            role === 'manager' ? <Navigate to="/kanban" /> :
            <DashboardLeader role={role} />
          } />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/catalog" element={<PartsCatalog />} />
          <Route path="/procurement" element={<Procurement />} />
          <Route path="/stale" element={<StaleInventory />} />
          <Route path="/kanban" element={<Kanban />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
