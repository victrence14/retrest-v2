import {test,expect} from "@playwright/test";

test.beforeAll(async({request})=>{
  await request.post("/api/session");
  const reset=await request.post("/api/demo/reset");
  expect(reset.ok()).toBe(true);
});
test.afterAll(async({request})=>{
  await request.post("/api/session");
  await request.post("/api/demo/reset");
});

test("desktop command center, merchant switches, receipt exports, and invite flow",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1050});
  await page.goto("/");await expect(page.getByRole("heading",{name:"Stay in control."})).toBeVisible();
  await page.waitForResponse(r=>r.url().endsWith("/api/state")&&r.status()===200);
  await page.screenshot({path:"test-results/shield-desktop.png",fullPage:true});
  await page.getByRole("switch",{name:"Pause Spotify",exact:true}).click();
  await expect(page.getByRole("switch",{name:"Activate Spotify",exact:true})).not.toBeChecked();
  await page.getByRole("switch",{name:"Activate Spotify",exact:true}).click();
  await expect(page.getByRole("switch",{name:"Pause Spotify",exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Try a live demo"}).click();
  for(const [scenario,result] of [["The everyday payment","Payment approved."],["The kill switch","Your money stayed put."],["The sneaky price hike","Your money stayed put."]]){
    const response=page.waitForResponse(r=>r.url().endsWith("/api/demo")&&r.request().method()==="POST");
    await page.locator(".demo-scenario").filter({hasText:scenario}).click();await response;
    await expect(page.locator(".demo-result")).toContainText(result);
  }
  await page.screenshot({path:"test-results/demo-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Close dialog"}).click();
  await page.getByRole("button",{name:"Pools & Split",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Share the plan."})).toBeVisible();
  await page.screenshot({path:"test-results/pools-desktop.png",fullPage:true});
  await page.getByRole("button",{name:"Create a pool",exact:true}).click();
  await page.locator('[name="pool_name"]').fill("The listening lounge");
  await page.locator('[name="name_1"]').fill("Amina Bello");await page.locator('[name="email_1"]').fill("amina@example.com");
  await page.locator('[name="name_2"]').fill("Femi Dada");await page.locator('[name="email_2"]').fill("femi@example.com");
  await page.getByRole("button",{name:"Create pool & get invite link"}).click();
  await expect(page.getByRole("heading",{name:"Your pool is ready."})).toBeVisible();
  const invite=await page.locator(".invite-link-text").innerText();
  const invitePage=await page.context().newPage();await invitePage.goto(invite);
  await invitePage.getByRole("textbox").fill("amina@example.com");await invitePage.getByRole("button",{name:"Simulate my contribution"}).click();
  await expect(invitePage.locator(".invite-success")).toContainText("demo contribution is in");await invitePage.close();
  await page.getByRole("button",{name:"Close dialog"}).click();
  await page.getByRole("button",{name:"Insights & Vault",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Make money moves."})).toBeVisible();
  await page.screenshot({path:"test-results/insights-desktop.png",fullPage:true});
  const download=page.waitForEvent("download");await page.getByRole("link",{name:"Export receipt pack"}).click();expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByLabel("Export receipt format").selectOption("pdf");const pdf=page.waitForEvent("download");await page.getByRole("link",{name:"Export receipt pack"}).click();expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  expect(errors).toEqual([]);
});

test("mobile has three tabs, no page overflow, and usable simulator",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/");
  await expect(page.getByRole("heading",{name:"Stay in control."})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.getByRole("navigation").getByRole("button")).toHaveCount(3);
  await page.screenshot({path:"test-results/shield-mobile.png",fullPage:true});
  await page.getByRole("button",{name:"Try a live demo"}).click();await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Close dialog"}).click();
  for(const [tab,heading] of [["Pools & Split","Share the plan."],["Insights & Vault","Make money moves."]]){
    await page.getByRole("button",{name:tab,exact:true}).click();await expect(page.getByRole("heading",{name:heading})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
