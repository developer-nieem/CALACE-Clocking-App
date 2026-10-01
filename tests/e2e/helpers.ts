import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../../lib/constants";

export async function login(page: Page, email = "admin@calace.team") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
