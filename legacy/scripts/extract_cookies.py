"""Extract YouTube cookies from Chrome and save in Netscape format"""
import browser_cookie3
import http.cookiejar

# Get Chrome cookies for youtube.com
cj = browser_cookie3.chrome(domain_name='.youtube.com')

# Convert to Netscape format file
output_file = 'youtube_cookies.txt'

with open(output_file, 'w') as f:
    f.write("# Netscape HTTP Cookie File\n")
    f.write("# https://curl.haxx.se/rfc/cookie_spec.html\n")
    f.write("# This is a generated file! Do not edit.\n\n")
    
    for cookie in cj:
        # Netscape format: domain, tailmatch, path, secure, expires, name, value
        secure = "TRUE" if cookie.secure else "FALSE"
        tailmatch = "TRUE" if cookie.domain.startswith('.') else "FALSE"
        expires = str(int(cookie.expires)) if cookie.expires else "0"
        
        line = f"{cookie.domain}\t{tailmatch}\t{cookie.path}\t{secure}\t{expires}\t{cookie.name}\t{cookie.value}\n"
        f.write(line)
        print(f"Cookie: {cookie.name}")

print(f"\n✅ Saved cookies to {output_file}")
