import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RequireAuth } from './components/layout/RequireAuth'
import { RoleGuard } from './components/layout/RoleGuard'
import { AuthProvider } from './contexts/AuthContext'
import { QueueProvider } from './contexts/QueueContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ConfirmationProvider } from './contexts/ConfirmationContext'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { LoginPage } from './pages/auth/LoginPage'
import { AssyQueuePage } from './pages/production/AssyQueuePage'
import { ProductionAllocationPage } from './pages/production/ProductionAllocationPage'
import { SupplyScanPage } from './pages/supply/SupplyScanPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { AssyStorePage } from './pages/inventory/AssyStorePage'
import { ProductionBufferPage } from './pages/inventory/ProductionBufferPage'
import { StockAdjustmentPage } from './pages/inventory/StockAdjustmentPage'
import { StockLedgerPage } from './pages/inventory/StockLedgerPage'
import { StockOverviewPage } from './pages/inventory/StockOverviewPage'
import { SubAssyStorePage } from './pages/inventory/SubAssyStorePage'
import { AssyPickupPage } from './pages/material/AssyPickupPage'
import { ExternalQueuePage } from './pages/material/ExternalQueuePage'
import { MaterialReceivingPage } from './pages/material/MaterialReceivingPage'
import { MaterialRequestPage } from './pages/material/MaterialRequestPage'
import { MaterialReturnPage } from './pages/material/MaterialReturnPage'
import { SupplyPickupPage } from './pages/material/SupplyPickupPage'
import { BomPage } from './pages/master/BomPage'
import { CycleTimePage } from './pages/master/CycleTimePage'
import { KanbanConfigPage } from './pages/master/KanbanConfigPage'
import { LocationsPage } from './pages/master/LocationsPage'
import { MachinesPage } from './pages/master/MachinesPage'
import { ModelsPage } from './pages/master/ModelsPage'
import { PartsPage } from './pages/master/PartsPage'
import { ShiftsPage } from './pages/master/ShiftsPage'
import { StockPolicyPage } from './pages/master/StockPolicyPage'
import { WorkAreasPage } from './pages/master/WorkAreasPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { AssyProductionPage } from './pages/production/AssyProductionPage'
import { ProductionResultsPage } from './pages/production/ProductionResultsPage'
import { SchedulePage } from './pages/production/SchedulePage'
import { SubAssyProductionPage } from './pages/production/SubAssyProductionPage'
import { SubAssyQueuePage } from './pages/production/SubAssyQueuePage'
import { InventoryReportPage } from './pages/reports/InventoryReportPage'
import { MaterialUsagePage } from './pages/reports/MaterialUsagePage'
import { NgReportPage } from './pages/reports/NgReportPage'
import { ProductionReportPage } from './pages/reports/ProductionReportPage'
import { TransactionReportPage } from './pages/reports/TransactionReportPage'
import { BackupPage } from './pages/settings/BackupPage'
import { NotificationsPage } from './pages/settings/NotificationsPage'
import { PreferencesPage } from './pages/settings/PreferencesPage'
import { PrintingPage } from './pages/settings/PrintingPage'
import { ProfilePage } from './pages/settings/ProfilePage'
import { DevicesPage } from './pages/users/DevicesPage'
import { RolesPermissionsPage } from './pages/users/RolesPermissionsPage'
import { UserListPage } from './pages/users/UserListPage'

export default function App() {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <ConfirmationProvider>
        <AuthProvider>
          <QueueProvider>
            <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/supply/scan"
                element={
                  <RequireAuth>
                    <SupplyScanPage />
                  </RequireAuth>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <RoleGuard>
                      <AppShell />
                    </RoleGuard>
                  </RequireAuth>
                }
              >
                <Route path="/" element={<DashboardPage />} />

                <Route path="/production/schedule" element={<SchedulePage />} />
                <Route path="/production/assy" element={<AssyProductionPage />} />
                <Route path="/production/assy-queue" element={<AssyQueuePage />} />
                <Route path="/production/queue" element={<SubAssyQueuePage />} />
                <Route path="/production/allocation" element={<ProductionAllocationPage />} />
                <Route path="/production/sub-assy" element={<SubAssyProductionPage />} />
                <Route path="/production/results" element={<ProductionResultsPage />} />

              <Route path="/material/request" element={<MaterialRequestPage />} />
              <Route path="/material/pickup" element={<SupplyPickupPage />} />
              <Route path="/material/return" element={<MaterialReturnPage />} />
              <Route path="/material/assy-pickup" element={<AssyPickupPage />} />
              <Route path="/material/external" element={<ExternalQueuePage />} />
              <Route path="/material/receiving" element={<MaterialReceivingPage />} />

              <Route path="/inventory/overview" element={<StockOverviewPage />} />
              <Route path="/inventory/buffer" element={<ProductionBufferPage />} />
              <Route path="/inventory/assy-store" element={<AssyStorePage />} />
              <Route path="/inventory/sub-assy-store" element={<SubAssyStorePage />} />
              <Route path="/inventory/ledger" element={<StockLedgerPage />} />
              <Route path="/inventory/adjustment" element={<StockAdjustmentPage />} />

              <Route path="/master/models" element={<ModelsPage />} />
              <Route path="/master/parts" element={<PartsPage />} />
              <Route path="/master/bom" element={<BomPage />} />
              <Route path="/master/cycle-time" element={<CycleTimePage />} />
              <Route path="/master/machines" element={<MachinesPage />} />
              <Route path="/master/stock-policy" element={<StockPolicyPage />} />
              <Route path="/master/locations" element={<LocationsPage />} />
              <Route path="/master/shifts" element={<ShiftsPage />} />
              <Route path="/master/kanban" element={<KanbanConfigPage />} />
              <Route path="/master/work-areas" element={<WorkAreasPage />} />

              <Route path="/reports/production" element={<ProductionReportPage />} />
              <Route path="/reports/inventory" element={<InventoryReportPage />} />
              <Route path="/reports/material-usage" element={<MaterialUsagePage />} />
              <Route path="/reports/ng" element={<NgReportPage />} />
              <Route path="/reports/transactions" element={<TransactionReportPage />} />

              <Route path="/users/list" element={<UserListPage />} />
              <Route path="/users/roles" element={<RolesPermissionsPage />} />
              <Route path="/users/devices" element={<DevicesPage />} />

              <Route path="/settings/profile" element={<ProfilePage />} />
              <Route path="/settings/preferences" element={<PreferencesPage />} />
              <Route path="/settings/notifications" element={<NotificationsPage />} />
              <Route path="/settings/printing" element={<PrintingPage />} />
              <Route path="/settings/backup" element={<BackupPage />} />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          </BrowserRouter>
        </QueueProvider>
        </AuthProvider>
        </ConfirmationProvider>
      </PreferencesProvider>
    </ThemeProvider>
  )
}
