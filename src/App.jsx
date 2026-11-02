
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./components/ui";
import { RequireAuth, RequireRole } from "./components/layout";
import { ActivatePage, LoginPage } from "./pages/auth";
import { DashboardPage } from "./pages/dashboards";
import {
  FeesPage,
  PaymentReturnPage,
  ReceiptsPage,
  RegistrationPage,
  ResultsPage,
  TranscriptPage,
} from "./pages/student";
import { TimetablePage } from "./pages/timetable";
import { ClassDetailPage, MyClassesPage } from "./pages/teaching";
import { OfferingsPage } from "./pages/offerings";
import { HodMarksUploadPage } from "./pages/hod-marks";
import { ResultsReviewPage } from "./pages/results";
import { LecturersPage, StudentsPage } from "./pages/admin-people";
import { HodsPage } from "./pages/admin-hods";
import { AcademicsPage } from "./pages/admin-academics";
import { FinancePage } from "./pages/admin-finance";
import { AuditPage, ReportsPage, ResultsAdminPage } from "./pages/admin-insights";
import {
  AdminEmergencyContactsPage,
  AnnouncementsPage,
  ContactAdminPage,
  EventsPage,
  HodPage,
  NotificationsPage,
} from "./pages/communication";

const STAFF = ["admin", "super_admin", "admissions", "finance", "registrar", "coordinator"];
const PEOPLE = ["admin", "super_admin", "admissions", "registrar", "finance", "hod"];
const ADMIN_ONLY = ["admin", "super_admin"];
const RESULTS_ADMIN = ["admin", "super_admin", "registrar"];
const REVIEW = ["admin", "super_admin", "registrar", "hod"];

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/activate" element={<ActivatePage />} />

            <Route element={<RequireAuth />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Student journey */}
              <Route path="/registration" element={<RequireRole roles={["student"]}><RegistrationPage /></RequireRole>} />
              <Route path="/fees" element={<RequireRole roles={["student"]}><FeesPage /></RequireRole>} />
              <Route path="/receipts" element={<RequireRole roles={["student"]}><ReceiptsPage /></RequireRole>} />
              <Route path="/results" element={<RequireRole roles={["student"]}><ResultsPage /></RequireRole>} />
              <Route path="/transcript" element={<RequireRole roles={["student"]}><TranscriptPage /></RequireRole>} />
              <Route path="/contact-admin" element={<RequireRole roles={["student"]}><ContactAdminPage /></RequireRole>} />
              <Route path="/payments/return" element={<PaymentReturnPage />} />
              <Route path="/timetable" element={<TimetablePage />} />

              {/* Teaching */}
              <Route path="/teaching/classes" element={<RequireRole roles={["lecturer", "hod"]}><MyClassesPage /></RequireRole>} />
              <Route path="/teaching/classes/:offeringId" element={<RequireRole roles={["lecturer", "hod"]}><ClassDetailPage /></RequireRole>} />
              <Route path="/offerings" element={<RequireRole roles={["lecturer", "hod", ...STAFF]}><OfferingsPage /></RequireRole>} />
              <Route path="/results-review" element={<RequireRole roles={REVIEW}><ResultsReviewPage /></RequireRole>} />
              <Route path="/hod" element={<RequireRole roles={["hod"]}><HodPage /></RequireRole>} />
              <Route path="/hod/marks-upload" element={<RequireRole roles={["hod"]}><HodMarksUploadPage /></RequireRole>} />

              {/* Administration */}
              <Route path="/admin/students" element={<RequireRole roles={PEOPLE}><StudentsPage /></RequireRole>} />
              <Route path="/admin/lecturers" element={<RequireRole roles={ADMIN_ONLY}><LecturersPage /></RequireRole>} />
              <Route path="/admin/hods" element={<RequireRole roles={ADMIN_ONLY}><HodsPage /></RequireRole>} />
              <Route path="/admin/academics" element={<RequireRole roles={["admin", "super_admin", "registrar", "coordinator"]}><AcademicsPage /></RequireRole>} />
              <Route path="/admin/finance" element={<RequireRole roles={["admin", "super_admin", "finance"]}><FinancePage /></RequireRole>} />
              <Route path="/admin/results-admin" element={<RequireRole roles={RESULTS_ADMIN}><ResultsAdminPage /></RequireRole>} />
              <Route path="/admin/reports" element={<RequireRole roles={["admin", "super_admin", "finance", "registrar"]}><ReportsPage /></RequireRole>} />
              <Route path="/admin/audit" element={<RequireRole roles={ADMIN_ONLY}><AuditPage /></RequireRole>} />
              <Route path="/admin/emergency-contacts" element={<RequireRole roles={ADMIN_ONLY}><AdminEmergencyContactsPage /></RequireRole>} />

              {/* Communication */}
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}