"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Mail,
  Lock,
  User,
  Eye as EyeIcon,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/lib/navigation";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface RegisterProps {
  onSwitchToLogin: () => void;
}

/**
 * The role values the backend expects, paired with what a person should read.
 *
 * Base UI renders the raw value in the trigger unless `SelectValue` is given a
 * function child, so picking a role used to leave "ORGANIC_FERTILIZER_PRODUCER"
 * sitting in the field on the sign-up form.
 */
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "FARMER", label: "Farmer" },
  { value: "SYSTEM_ADMIN", label: "System Admin" },
  { value: "GOVERNMENT_ADMIN", label: "Government Admin" },
  { value: "AGRARIAN_SERVICE_OFFICER", label: "Agrarian Service Officer" },
  { value: "PRIVATE_AGRO_DEALER", label: "Private Agro Dealer" },
  { value: "ORGANIC_FERTILIZER_PRODUCER", label: "Organic Fertilizer Producer" },
];

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register } = useAuth();

  const formik = useFormik({
    initialValues: {
      email: "",
      username: "",
      password: "",
      role: "",
    },
    validationSchema: Yup.object({
      email: Yup.string().email("Invalid email address").required("Required"),
      username: Yup.string().required("Required"),
      password: Yup.string()
        .min(4, "Must be at least 4 characters")
        .required("Required"),
      role: Yup.string().required("Required"),
    }),
    onSubmit: async (values) => {
      setServerError(null);
      try {
        await register({
          email: values.email,
          username: values.username,
          password: values.password,
          role: values.role
        });
        toast.success("Account created successfully!");
      } catch (error: any) {
        setServerError(
          error?.response?.data?.message || error?.message || "An unexpected error occurred. Please try again."
        );
      }
    },
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center lg:text-left space-y-2">
        <CardTitle className="text-3xl lg:text-4xl font-bold font-clash-display">
          Create Account
        </CardTitle>
        <CardDescription>
          Join us today and find your perfect boarding place.
        </CardDescription>
      </CardHeader>
      <CardContent>

        <form onSubmit={formik.handleSubmit} className="mt-2 space-y-5">
          {serverError && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              {serverError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
                <Input
                  type="email"
                  {...formik.getFieldProps("email")}
                  className="pl-10 h-10"
                  aria-invalid={!!(formik.touched.email && formik.errors.email)}
                  placeholder="you@example.com"
                />
              </div>
              {formik.touched.email && formik.errors.email ? (
                <div className="text-destructive text-xs mt-1">
                  {formik.errors.email}
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                User Name
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <User className="h-5 w-5" />
                </div>
                <Input
                  type="text"
                  {...formik.getFieldProps("username")}
                  className="pl-10 h-10"
                  aria-invalid={!!(formik.touched.username && formik.errors.username)}
                  placeholder="Enter username"
                />
              </div>
              {formik.touched.username && formik.errors.username ? (
                <div className="text-destructive text-xs mt-1">
                  {formik.errors.username}
                </div>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                  <Lock className="h-5 w-5" />
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  {...formik.getFieldProps("password")}
                  className="pl-10 pr-12 h-10"
                  aria-invalid={!!(formik.touched.password && formik.errors.password)}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {formik.touched.password && formik.errors.password ? (
                <div className="text-destructive text-xs mt-1">
                  {formik.errors.password}
                </div>
              ) : null}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Role
              </label>
              <div className="relative group">
                <Select
                  value={formik.values.role}
                  onValueChange={(val) => formik.setFieldValue('role', val)}
                >
                  <SelectTrigger className={`w-full ${formik.touched.role && formik.errors.role ? 'border-destructive focus-visible:ring-destructive focus-visible:ring-offset-2' : ''}`}>
                    <SelectValue>
                      {(value) =>
                        ROLE_OPTIONS.find((option) => option.value === String(value ?? ""))
                          ?.label ?? "Select a role"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formik.touched.role && formik.errors.role ? (
                <div className="text-destructive text-xs mt-1">
                  {formik.errors.role}
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formik.isSubmitting ? "Creating Account..." : "Register"}
          </button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <div className="text-center mt-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Already have an account? Sign in
          </button>
        </div>
      </CardFooter>
    </Card>
  );
}
