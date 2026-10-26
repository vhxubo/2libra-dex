import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

const BadgeDexPage = lazy(() => import('@/features/badges/BadgeDexPage'))
const GifMakerPage = lazy(() => import('@/features/badges/gif/GifMakerPage'))
const PandoraEventsPage = lazy(() => import('@/features/pandora/PandoraEventsPage'))
const DataSourcesPage = lazy(() => import('@/features/sources/DataSourcesPage'))
const AuthCallbackPage = lazy(() => import('@/features/auth/AuthCallbackPage'))

export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Suspense
          fallback={
            <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
              正在加载页面…
            </p>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/badges" replace />} />
            <Route path="/badges" element={<BadgeDexPage />} />
            <Route path="/gif-maker" element={<GifMakerPage />} />
            <Route path="/pandoras" element={<PandoraEventsPage />} />
            <Route path="/sources" element={<DataSourcesPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="*" element={<Navigate to="/badges" replace />} />
          </Routes>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
