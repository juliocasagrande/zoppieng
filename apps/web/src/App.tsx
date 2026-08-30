import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./shell/AuthContext.js";
import { ProtectedRoute } from "./shell/ProtectedRoute.js";
import { ShellLayout } from "./shell/layout/ShellLayout.js";
import { DashboardPage } from "./shell/pages/Dashboard.js";
import { LoginPage } from "./shell/pages/Login.js";
import { ResetPasswordPage } from "./shell/pages/ResetPassword.js";
import { ReportsListPage } from "./shell/pages/ReportsList.js";
import { ReportWizardPage } from "./shell/pages/ReportWizard.js";
import { ReportDetailPage } from "./shell/pages/ReportDetail.js";
import { ReviewQueuePage } from "./shell/pages/ReviewQueue.js";
import { AccessoryCatalogPage } from "./shell/pages/AccessoryCatalog.js";
import { FieldOptionsAdminPage } from "./shell/pages/FieldOptionsAdmin.js";
import { RegistryClientsPage } from "./shell/pages/registry/RegistryClients.js";
import { RegistrySuppliersPage } from "./shell/pages/registry/RegistrySuppliers.js";
import { RegistryServiceProvidersPage } from "./shell/pages/registry/RegistryServiceProviders.js";
import { RegistryEngineersPage } from "./shell/pages/registry/RegistryEngineers.js";
import { RegistryEquipmentPage } from "./shell/pages/registry/RegistryEquipment.js";
import { RegistryVehiclesPage } from "./shell/pages/registry/RegistryVehicles.js";
import { CompanyAdminPage } from "./shell/pages/CompanyAdmin.js";
import { BillingPage } from "./shell/pages/Billing.js";
import { BestPracticesPage } from "./shell/pages/BestPracticesAdmin.js";
import { ProfilePage } from "./shell/pages/Profile.js";
import { FieldWizard } from "./field/FieldWizard.js";
import { VerifyPage } from "./verify/VerifyPage.js";
import { useAuth } from "./shell/AuthContext.js";

function ReportCreationRoute() {
  const { profile } = useAuth();
  if (!profile?.can_create_reports) {
    return <Navigate to={profile?.role === "company_admin" ? "/app/billing" : "/app/best-practices"} replace />;
  }
  return <ReportWizardPage />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/f/:token" element={<FieldWizard />} />
        <Route path="/verify/:reportId" element={<VerifyPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <ShellLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/new" element={<ReportCreationRoute />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="accessories" element={<AccessoryCatalogPage />} />
          <Route path="registry/clients" element={<RegistryClientsPage />} />
          <Route path="registry/suppliers" element={<RegistrySuppliersPage />} />
          <Route path="registry/service-providers" element={<RegistryServiceProvidersPage />} />
          <Route path="registry/engineers" element={<RegistryEngineersPage />} />
          <Route path="registry/equipment" element={<RegistryEquipmentPage />} />
          <Route path="registry/vehicles" element={<RegistryVehiclesPage />} />
          <Route path="field-options" element={<FieldOptionsAdminPage />} />
          <Route path="company" element={<CompanyAdminPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="best-practices" element={<BestPracticesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  );
}
