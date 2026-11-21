// Optional local UI QA. Uses an existing Playwright installation and Chromium.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const failures=[];page.on('pageerror',e=>failures.push(e.message));
page.on('console',m=>{if(m.type()==='error')failures.push(m.text());});
const base=process.env.TEST_URL || 'http://127.0.0.1:4173';
const results=[];
const skipFileTests=process.env.SKIP_FILE_TESTS==='1';
const reviewTitle=skipFileTests?'Исследование закона Ома':'Расчёт электрических цепей';
async function check(name,fn){await fn();results.push(name);console.log('PASS',name);}
await mkdir('work/screenshots',{recursive:true});
try{
  await check('Login screen respects the configured production endpoint',async()=>{
    await page.goto(base);await page.getByRole('heading',{name:'С возвращением'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Войти в приложение'}).isDisabled(),!await page.evaluate(()=>Boolean(window.PRACTICUS_CONFIG.apiUrl)));
    await page.screenshot({path:'work/screenshots/login.png',fullPage:true});
  });
  await check('Student filters, search, archive grade only',async()=>{
    await page.getByRole('button',{name:'Студент',exact:true}).click();await page.getByRole('heading',{name:'Мои практические'}).waitFor();
    assert.equal(await page.locator('tbody tr').count(),7);
    await page.getByRole('button',{name:'На доработке',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),1);
    await page.locator('[data-action="filter"][data-value="all"]').click();
    await page.getByRole('searchbox').fill('несуществующее задание');await page.getByRole('heading',{name:'Работ пока нет'}).waitFor();
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button',{name:'Основы электрических измерений',exact:true}).click();await page.getByText('В архиве доступна только оценка.').waitFor();
    assert.equal(await page.locator('[data-action="download"]').count(),0);
    await page.getByRole('button',{name:'Все практические'}).click();
    await page.screenshot({path:'work/screenshots/student.png',fullPage:true});
  });
  if(!skipFileTests)await check('Student uploads, replacement confirmation and old-file removal',async()=>{
    await page.getByRole('button',{name:'Расчёт электрических цепей',exact:true}).click();
    await page.locator('#upload-files').setInputFiles({name:'Отчёт.txt',mimeType:'text/plain',buffer:Buffer.from('Первый отчёт')});
    await page.getByRole('button',{name:'Отправить работу',exact:true}).click();
    await page.getByRole('heading',{name:'Ваша сдача',exact:true}).waitFor();
    assert.equal(await page.locator('#main').getByText('На проверке',{exact:true}).count(),1);
    await page.locator('#upload-files').setInputFiles({name:'Новый отчёт.txt',mimeType:'text/plain',buffer:Buffer.from('Исправленный отчёт')});
    await page.getByRole('button',{name:'Отправить работу',exact:true}).click();
    await page.getByRole('heading',{name:'Заменить комплект файлов?'}).waitFor();
    await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByText('Отчёт.txt',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Скачать Новый отчёт.txt',exact:true}).waitFor();
    assert.equal(await page.getByText('Отчёт.txt',{exact:true}).count(),0);
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Скачать Новый отчёт.txt',exact:true}).click();
    const download=await downloadPromise;assert.equal(download.suggestedFilename(),'Новый отчёт.txt');
    await page.screenshot({path:'work/screenshots/detail.png',fullPage:true});
  });
  await check('Teacher review optional grade and late revision',async()=>{
    await page.locator('#demo-role').selectOption('teacher');await page.getByRole('heading',{name:'Практические работы',exact:true}).waitFor();
    const row=page.locator('tbody tr').filter({has:page.getByRole('button',{name:reviewTitle,exact:true})});
    await row.getByRole('button',{name:'Проверить',exact:true}).click();
    await page.getByRole('heading',{name:'Проверка работ',exact:true}).waitFor();
    const student=page.locator('tbody tr').filter({hasText:'Алексей Соколов'});
    await student.getByRole('button',{name:'Проверить',exact:true}).click();
    await page.locator('#decision').selectOption('needs_revision');await page.locator('#feedback').fill('Добавьте вывод.');
    await page.getByRole('button',{name:'Сохранить решение'}).click();await page.locator('#modal').waitFor({state:'hidden'});
    await student.getByText('На доработке',{exact:true}).waitFor();
    await page.screenshot({path:'work/screenshots/teacher.png',fullPage:true});
    await page.locator('#demo-role').selectOption('student');await page.getByRole('button',{name:reviewTitle,exact:true}).click();
    await page.getByText('Добавьте вывод.',{exact:true}).waitFor();
  });
  await check('Teacher creates assignment and publishes it',async()=>{
    await page.locator('#demo-role').selectOption('teacher');await page.getByRole('button',{name:'Создать задание',exact:true}).first().click();
    await page.locator('#f-title').fill('Тест интерфейса <script>');await page.locator('#f-description').fill('Проверка безопасного текста');
    await page.locator('input[name="target"]').first().check();await page.locator('#publication').selectOption('published');
    await page.getByRole('button',{name:'Создать задание',exact:true}).last().click();await page.locator('#modal').waitFor({state:'hidden'});
    await page.getByRole('heading',{name:'Тест интерфейса <script>',exact:true}).waitFor();
    assert.equal(await page.locator('#main script').count(),0);
  });
  await check('Admin creates user, edits quota, resets password once, updates access',async()=>{
    await page.locator('#demo-role').selectOption('admin');await page.getByRole('heading',{name:'Обзор приложения'}).waitFor();
    await page.getByRole('button',{name:'Пользователи',exact:true}).click();await page.getByRole('button',{name:'Добавить пользователя'}).click();
    await page.locator('#f-full_name').fill('Тестовый Студент');await page.locator('#f-login').fill('test.student');await page.locator('#user-group').selectOption('g1');
    await page.getByRole('button',{name:'Создать пользователя',exact:true}).click();await page.getByRole('heading',{name:'Временный пароль'}).waitFor();
    assert((await page.locator('.password-reveal').textContent()).length>=10);
    await page.getByRole('button',{name:'Пароль сохранён'}).click();
    const user=page.locator('tbody tr').filter({hasText:'Тестовый Студент'});await user.getByRole('button',{name:'Управление'}).click();
    await page.locator('#f-quota').fill('150');await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});
    await user.getByText('/ 150 МиБ',{exact:false}).waitFor();await user.getByRole('button',{name:'Управление'}).click();
    await page.getByRole('button',{name:'Сбросить пароль',exact:true}).click();await page.getByRole('button',{name:'Подтвердить',exact:true}).click();
    await page.getByRole('heading',{name:'Временный пароль'}).waitFor();assert(await page.locator('.password-reveal').isVisible());
    await page.getByRole('button',{name:'Пароль сохранён'}).click();
    await page.getByRole('button',{name:'Доступ преподавателей',exact:true}).click();await page.getByRole('button',{name:'Настроить',exact:true}).click();
    await page.locator('input[name="target"][value="g2"]').uncheck();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.locator('#modal').waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.getByRole('heading',{name:'Резервные копии',exact:true}).waitFor();await page.getByRole('button',{name:'Создать копию',exact:true}).click();await page.getByText(/Последняя копия:/).waitFor();await page.getByRole('button',{name:'Обзор',exact:true}).click();await page.screenshot({path:'work/screenshots/admin.png',fullPage:true});
  });
  await check('Dark theme persists without credentials in localStorage',async()=>{
    await page.getByRole('button',{name:'Сменить тему'}).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    const entries=await page.evaluate(()=>Object.keys(localStorage));assert.deepEqual(entries,['practicus-theme']);
    await page.screenshot({path:'work/screenshots/dark.png',fullPage:true});
  });
  await check('Narrow viewport has no body overflow; navigation works',async()=>{
    await page.setViewportSize({width:390,height:844});await page.goto(base+'/?demo=student');await page.getByRole('heading',{name:'Мои практические'}).waitFor();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
    await page.getByRole('button',{name:'Расчёт электрических цепей',exact:true}).click();await page.getByRole('heading',{name:'О практической',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:'work/screenshots/mobile.png',fullPage:true});
  });
  assert.deepEqual(failures,[],'Browser console/page errors');
  await writeFile('work/browser-results.json',JSON.stringify({browser:'Chromium',results,errors:failures},null,2));
  console.log(`${results.length} UI flows passed; no browser errors`);
}finally{await browser.close();}
