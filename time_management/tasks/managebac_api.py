import asyncio
import time
import aiohttp
import lxml.html
import requests as req
from bs4 import BeautifulSoup
import concurrent.futures
import re


cal = {"Jan": 1,"Feb": 2,"Mar": 3,"Apr": 4,"May": 5,"Jun": 6,"Jul": 7,"Aug": 8,"Sep": 9,"Oct": 10,"Nov": 11,"Dec": 12,}
fdict = {"studentname": "", "deadlines": [], "tasks": []}
cookiestart = ["_managebac_session", "managebac_session", "_managebac_session: "]
class NoDomain(Exception):
    def __init__(self, message="""Make sure you defined the domain in the function. main("domain", "cookie")\nEx:run("myschool",cookie) OR run("myschool.managebac.com",cookie)"""):
        self.message = message
        super().__init__(self.message)

class NoCookie(Exception):
    def __init__(self, message="""Make sure you defined the cookie in the function. main("domain", "cookie")\nEx:run(domain,"0sjd8cho1oasd98afashvas9qryt8q3845iqengfiehr")"""):
        self.message = message
        super().__init__(self.message)

class InvalidURL(Exception):
    def __init__(self, domain, url, message="""INVALID URL: Make sure you defined the domain PROPERLY in the function. main("domain", "cookie")\nEx:run("myschool",cookie) OR run("myschool.managebac.com",cookie)"""):
        self.message = message
        self.url = url
        self.domain = domain
    
    def __str__(self):
        print(f"https://[red]{self.domain}[/red].managebac.com")
        return  "is an invalid domain, please verify information and retry"

def mbapi(domain:str=None, cookie:str=None):
    """
    Param DOMAIN: the subdomain of your FariaOne ManageBac site (The ****. part of ****.managebac.com)
    Param COOKIE: Your MB authentication cookie (it's called _managebac_session) that you can find by pressing F12, then clicking Storage, and Cookies. (Only the value!)
    """
    fdict = {"studentname": "", "tasks": []}
    domain = domain or None
    cookie = cookie or None
    if domain == None and cookie == None:
        domain = input("""What is the subdomain of your school's ManageBac site?\nEnter ONLY the subdomain (****).managebac.com:\n""")
        cookie = input("""What is the session cookie of your ManageBac login?\nEnter ONLY the subdomain value, not the name of the cookie:\n""")
    elif domain != None and cookie == None:
        raise NoCookie
    elif domain == None and cookie != None:
        raise NoDomain

    def cookiecheck(cookie):
        if len(cookie)<30:
            raise NoCookie
        for i in cookiestart:
            if cookie.startswith(i):
                cookie = cookie.replace(i, "")
    def domaincheck(domain):
        if domain.endswith("""managebac.com"""):
            domain = domain.replace(".managebac.com",'')
    cookiecheck(cookie)
    domaincheck(domain)
    try:
        cook = {"_managebac_session": f"{cookie}", "hide_osc_announcement_modal" : "true"}
        ddeadline = []
        dtask = []
        url = f"https://{domain}.managebac.com/student/tasks_and_deadlines?upcoming_page="
        for i in range(1,4):
            try:
                r = req.get(url+f"{i}",cookies=cook)
            except Exception as e:
                print(f"https://[red]{domain}[/red].managebac.com/student/tasks_and_deadlines?upcoming_page=")
                raise InvalidURL(domain, url)
            soup = BeautifulSoup(r.content, "html.parser")
            results = soup.find(class_="upcoming-tasks")
            try:
                name = soup.find("title").text
                print(name)
                name = name.split('| ')[1]
                tasks = results.find_all("div", class_="line task-node anchor js-presentation")
                deadlines = results.find_all("div", class_="line")
            except Exception as e:
                print(e)
            try:
                tasks = results.find_all("div", class_="line task-node anchor js-presentation")
                deadlines = results.find_all("div", class_="line")
            except Exception as e:
                raise InvalidURL(domain, url)
            for task in tasks: 
                date_badge = task.find("div", class_="date-badge")
                if date_badge:
                    day_div = date_badge.find("div", class_="day")
                    month_div = date_badge.find("div", class_="month")
                    
                    day = day_div.text.strip() if day_div else "Unknown"
                    month = month_div.text.strip() if month_div else "Unknown"
                else:
                    day, month = "Unknown", "Unknown"

                title_tag = task.find("h4", class_="title")
                title = title_tag.find("a").text.strip() if title_tag and title_tag.find("a") else "No Title"

                link_tag = task.find("a", href=True)
                link = link_tag["href"] if link_tag else "#"
                
                id = link.split("core_tasks/", 1)[1] if "core_tasks/" in link else "Unknown"

                tdict = {
                    "id": id,
                    "link": f"https://{domain}.managebac.com{str(link)}",
                    "title": title,
                    "due-date": f"{day}/{cal.get(month, 'Unknown')}"
                }
                dtask.append(tdict)

            for task in deadlines:
                title_tag = task.find("h4", class_="title")
                title = title_tag.find("a").text.strip() if title_tag and title_tag.find("a") else "No Title"

                date_badge = task.find("div", class_="date-badge")
                if date_badge:
                    day_div = date_badge.find("div", class_="day")
                    month_div = date_badge.find("div", class_="month")
                    
                    day = day_div.text.strip() if day_div else "Unknown"
                    month = month_div.text.strip() if month_div else "Unknown"
                else:
                    day, month = "Unknown", "Unknown"

                link_tag = task.find("a", href=True)
                link = link_tag["href"] if link_tag else "#"

                id = link.split("core_tasks/", 1)[1] if "core_tasks/" in link else "Unknown"

                ddict = {
                    "id": id,
                    "link": f"https://{domain}.managebac.com{str(link)}",
                    "title": title,
                    "due-date": f"{day}/{cal.get(month, 'Unknown')}"
                }
                ddeadline.append(ddict)

        fdict["studentname"] = name
        fdict["tasks"] = dtask
    except Exception as e:
        print(e)
    return fdict

async def fetch_task(session, base_url, task_url):
    url = base_url + task_url
    
    async with session.get(url) as resp:
        html = await resp.read()
    
    tree = lxml.html.fromstring(html)
    
    if re.search(r'/core_tasks/\d+$', url):
        results = tree.xpath('//div[contains(@class, "fusion-section-content") '
                        'and contains(@class, "core-task-details")]')
    elif re.search(r'/events/\d+$', url):
        results = tree.xpath(
        './/div[contains(@class, "fusion-card-item") and '
        'contains(@class, "flex") and '
        'contains(@class, "flex-column") and '
        'contains(@class, "flex-normal")]'
        )
        
    container = results[0] if results else print(f"URL {url}: no container")
    
    title_list = container.xpath('.//h4[@class="title"]/text()')
    title = title_list[0].strip() if title_list else "No Title"
    
    subject_container = tree.xpath('.//a[@tooltip="Go to Overview"]/text()')
    subject = subject_container[0].strip() if subject_container else "No Class Title"


    date_badge = container.xpath('.//div[contains(@class, "date-badge")]')
    if date_badge:
        day_list = date_badge[0].xpath('.//div[@class="day"]/text()')
        month_list = date_badge[0].xpath('.//div[@class="month"]/text()')
        day = day_list[0].strip() if day_list else "Unknown"
        month = month_list[0].strip() if month_list else "Unknown"
    else:
        day, month = "Unknown", "Unknown"
        
        
    if re.search(r'/core_tasks/\d+$', url):
        id_part = url.split("core_tasks/", 1)[1]
    elif re.search(r'/events/\d+$', url):
        id_part = url.split("events/", 1)[1]
    else:
        id_part = "Unknown"

    desc_container = container.xpath(
        './/div[contains(@class, "fix-body-margins") and '
        'contains(@class, "redactor-styles") and '
        'contains(@class, "fr-view") and '
        'contains(@class, "fr-element")]'
    )
    if desc_container:
        paragraphs = desc_container[0].xpath('.//p')
        description_lines = [
            p.text_content().strip() for p in paragraphs
            if p.text_content().strip()
        ]
        description_final = "\n".join(description_lines) if description_lines else "No Description"
    else:
        description_final = "No Description"

    tdict = {
        "id": id_part,
        "link": url, 
        "title": title,
        "subject": subject,
        "description": description_final,
        "due-date": f"{day}/{cal.get(month, 'Unknown')}"
    }
    return tdict

async def fetch_urls_upcoming(session, base_url, page_num):
        url = base_url + f"/student/tasks_and_deadlines?upcoming_page={page_num}"
        
        async with session.get(url) as resp:
            html = await resp.read()
        
        tree = lxml.html.fromstring(html)
                
        student_name = ""
        title_list = tree.xpath('//title/text()')
        if title_list:
            try:
                student_name = title_list[0].split("| ")[1].strip()
            except Exception as e:
                print(e)
                
        results = tree.xpath('//div[contains(@class, "upcoming-tasks")]')
        task_links = []
        if results:
            h4_elems = results[0].xpath('.//h4[@class="title"]')
            for h4 in h4_elems:
                link_list = h4.xpath('.//a/@href')
                task_links.extend(link_list)
                    
        return student_name, task_links

async def fetch_urls_completed(session, base_url, page_num):
        url = base_url + f"/student/tasks_and_deadlines?completed_page={page_num}"
            
        async with session.get(url) as resp:
            html_completed = await resp.read()
        
        tree = lxml.html.fromstring(html_completed)
                
        student_name = ""
        title_list = tree.xpath('//title/text()')
        if title_list:
            try:
                student_name = title_list[0].split("| ")[1].strip()
            except Exception as e:
                print(e)

                
        results = tree.xpath('//div[contains(@class, "completed")]')
        
        task_links = []
        if results:
            for result in results:
                h4_elems = result.xpath('.//h4[@class="title"]')
                for h4 in h4_elems:
                    link_list = h4.xpath('.//a/@href')
                    task_links.extend(link_list)
                    
        return student_name, task_links
    
async def mbapi2(page_num, type, domain:str=None, cookie:str=None):
    fdict = {"studentname": "", "tasks": []}
    domain = domain or None
    cookie = cookie or None
    if domain == None and cookie == None:
        domain = input("""What is the subdomain of your school's ManageBac site?\nEnter ONLY the subdomain (****).managebac.com:\n""")
        cookie = input("""What is the session cookie of your ManageBac login?\nEnter ONLY the subdomain value, not the name of the cookie:\n""")
    elif domain != None and cookie == None:
        raise NoCookie
    elif domain == None and cookie != None:
        raise NoDomain
    def cookiecheck(cookie):
        if len(cookie)<30:
            raise NoCookie
        for i in cookiestart:
            if cookie.startswith(i):
                cookie = cookie.replace(i, "")
    def domaincheck(domain):
        if domain.endswith("""managebac.com"""):
            domain = domain.replace(".managebac.com",'')
    cookiecheck(cookie)
    domaincheck(domain)
    
    try:
        headers = {
            "Cookie": f"_managebac_session={cookie}; hide_osc_announcement_modal=true",
            "Accept-Encoding": "br, gzip, deflate"
        }
        base_url = f"https://{domain}.managebac.com"
        async with aiohttp.ClientSession(headers=headers) as session:
            
            start_inputtime = time.perf_counter()
            end_inputtime = time.perf_counter()
            
            start_urlfetchtime = time.perf_counter()
            if type == "completed":
                tasks_pages = [fetch_urls_completed(session, base_url, page_num)] 
            else: 
                tasks_pages = [fetch_urls_upcoming(session, base_url, page_num)] 
            pages_results = await asyncio.gather(*tasks_pages)
            end_urlfetchtime = time.perf_counter()
            
            student_name = ""
            taskurls = []
            for name, links in pages_results:
                if name and not student_name:
                    student_name = name
                taskurls.extend(links)
            taskurls = list(set(taskurls)) 
            print(len(taskurls))

            start_tasksfetchtime = time.perf_counter()
            task_details = await asyncio.gather(*(fetch_task(session, base_url, url) for url in taskurls))
            task_details = [td for td in task_details if td is not None]
            end_tasksfetchtime = time.perf_counter()
            
            print(f"User input time: {end_inputtime - start_inputtime:.4f} seconds")
            print(f"Url fetch time: {end_urlfetchtime - start_urlfetchtime:.4f} seconds")
            print(f"Task fetch time: {end_tasksfetchtime - start_tasksfetchtime:.4f} seconds")
        fdict["studentname"] = student_name
        fdict["tasks"] = task_details
    except Exception as e:
        print(e)
    return fdict
