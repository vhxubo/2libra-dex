import { Navigate, Route, Routes } from 'react-router-dom'
import BadgeDexPage from '@/features/badges/BadgeDexPage'
import DataSourcesPage from '@/features/sources/DataSourcesPage'
import PandoraEventsPage from '@/features/pandora/PandoraEventsPage'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/badges" replace />} />
          <Route path="/badges" element={<BadgeDexPage />} />
          <Route path="/pandora" element={<PandoraEventsPage />} />
          <Route path="/sources" element={<DataSourcesPage />} />
          <Route path="*" element={<Navigate to="/badges" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}
