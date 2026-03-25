import { UserProvider } from './context/UserContext'
import { AgentProvider, useAgent } from './context/AgentContext'
import { AppShell } from './layout/AppShell'
import { AICanvas } from './canvas/AICanvas'
import { SourcesPage } from './pages/SourcesPage'

function MainContent() {
  const { state } = useAgent()

  if (state.activeContext === 'sources') {
    return <SourcesPage />
  }

  return <AICanvas />
}

export default function App() {
  return (
    <UserProvider>
      <AgentProvider>
        <AppShell>
          <MainContent />
        </AppShell>
      </AgentProvider>
    </UserProvider>
  )
}
