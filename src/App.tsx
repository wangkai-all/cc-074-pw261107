import { useState } from 'react'
import { AppShell, type Route } from './components/AppShell'
import { DatasetsPage } from './components/DatasetsPage'
import { DatasetDetailPage } from './components/DatasetDetailPage'
import { AppsPage } from './components/AppsPage'
import { GrantsPage } from './components/GrantsPage'
import { DependenciesPage } from './components/DependenciesPage'
import { CatalogPage } from './components/CatalogPage'

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'datasets' })
  const navigate = (r: Route) => {
    setRoute(r)
    window.scrollTo({ top: 0 })
  }

  return (
    <AppShell route={route} navigate={navigate}>
      {route.name === 'datasets' && <DatasetsPage navigate={navigate} />}
      {route.name === 'dataset-detail' && <DatasetDetailPage id={route.id} navigate={navigate} />}
      {route.name === 'apps' && <AppsPage navigate={navigate} />}
      {route.name === 'grants' && <GrantsPage />}
      {route.name === 'dependencies' && <DependenciesPage navigate={navigate} />}
      {route.name === 'catalog' && <CatalogPage />}
    </AppShell>
  )
}
