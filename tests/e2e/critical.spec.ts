import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("critical workforce flows", () => {
  test("admin login loads the dashboard without an auth loop", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/dashboard|today|schedule|workforce/i).first()).toBeVisible();
  });

  test("admin sees staff and instructors in Users", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page);
    await page.goto("/users");
    await expect(page.getByRole("button", { name: "Add Employee" })).toBeVisible();
    await expect(page.getByText("Olivia Wilson").first()).toBeVisible();
    await expect(page.getByText("Maria Santos").first()).toBeVisible();
  });

  test("schedule workspace loads for admin", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page);
    await page.goto("/schedule");
    await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  });

  test("employee clock in/out with mocked geolocation", async ({ page, context }) => {
    test.skip(test.info().project.name === "mobile");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 34.05, longitude: -118.25 });
    await login(page, "olivia.wilson@calace.team");
    await page.goto("/time-clock");
    await expect(page.getByRole("heading", { name: /clock/i })).toBeVisible();
    const clockIn = page.getByText("Clock in", { exact: false }).first();
    if (await clockIn.isVisible()) {
      await clockIn.click();
      await expect(page.getByText(/clocked in|work time|processing/i).first()).toBeVisible();
    }
  });

  test("time clock still loads when outside the geofence", async ({ page, context }) => {
    test.skip(test.info().project.name === "mobile");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 47.6, longitude: -122.3 });
    await login(page, "olivia.wilson@calace.team");
    await page.goto("/time-clock");
    await expect(page.getByText(/location/i).first()).toBeVisible();
  });

  test("time off and open shift pages load", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page, "olivia.wilson@calace.team");
    await page.goto("/time-off");
    await expect(page.getByRole("heading", { name: "Time Off", exact: true })).toBeVisible();
    await page.goto("/open-shifts");
    await expect(page.getByRole("heading", { name: "Open Shifts", exact: true })).toBeVisible();
  });

  test("scheduler is denied payroll and staff cannot open another employee", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page, "scheduler@calace.team");
    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll" })).toHaveCount(0);
    await page.context().clearCookies();
    await login(page, "olivia.wilson@calace.team");
    await page.goto("/users/00000000-0000-0000-0000-000000000204");
    await expect(page.getByRole("heading", { name: /maria/i })).toHaveCount(0);
  });

  test("timesheet, billing, and payroll pages load for admin", async ({ page }) => {
    test.skip(test.info().project.name === "mobile");
    await login(page);
    await page.goto("/timesheets");
    await expect(page.getByRole("heading", { name: /clock report|clock history|timesheet/i })).toBeVisible();
    await page.goto("/payroll");
    await expect(page.getByRole("heading", { name: "Payroll" })).toBeVisible();
    await page.goto("/billing");
    await expect(page.getByRole("heading", { name: /billing|invoice/i })).toBeVisible();
  });
});

test.describe("mobile layout", () => {
  test("employee dashboard does not overflow horizontally", async ({ page }) => {
    test.skip(test.info().project.name !== "mobile");
    await login(page, "olivia.wilson@calace.team");
    for (const path of ["/dashboard", "/time-clock", "/schedule", "/tasks", "/notifications"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 8);
      expect(overflow, `${path} overflowed`).toBe(false);
    }
  });
});
