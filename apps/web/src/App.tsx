import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./shell/AuthContext.js";
import { ProtectedRoute } from "./shell/ProtectedRoute.js";
import { ShellLayout } from "./shell/layout/ShellLayout.js";
import { LoginPage } from "./shell/pages/Login.js";
import { ReportsListPage } from "./shell/pages/ReportsList.js";
import { ReportWizardPage } from "./shell/pages/ReportWizard.js";
import { ReportDetailPage } from "./shell/pages/ReportDetail.js";
import { ReviewQueuePage } from "./shell/pages/ReviewQueue.js";
import { AccessoryCatalogPage } from "./shell/pages/AccessoryCatalog.js";
import { CompanyAdminPage } from "./shell/pages/CompanyAdmin.js";
import { BillingPage } from "./shell/pages/Billing.js";
import { BestPracticesPage } from "./shell/pages/BestPracticesAdmin.js";
import { FieldWizard } from "./field/FieldWizard.js";
import { VerifyPage } from "./verify/VerifyPage.js";

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
          <Route index element={<Navigate to="reports" replace />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/new" element={<ReportWizardPage />} />
          <Route path="reports/:id" element={<ReportDetailPage />} />
          <Route path="review" element={<ReviewQueuePage />} />
          <Route path="accessories" element={<AccessoryCatalogPage />} />
          <Route path="company" element={<CompanyAdminPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="best-practices" element={<BestPracticesPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </AuthProvider>
  );
}
