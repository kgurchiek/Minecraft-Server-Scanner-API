# Minecraft-Server-Scanner-API
An API to fetch from my server scanner's database. The servers are found by the [scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner), then updated and written to the database by the [rescanner](https://github.com/kgurchiek/Minecraft-Server-Rescanner). You can find the schema of the PostgreSQL database in the [scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner), then updated and written to the database by the [rescanner's repo](https://github.com/kgurchiek/Minecraft-Server-Rescanner). This API is used by https://github.com/kgurchiek/Minecraft-Server-Scanner-Discord-Bot.

## Config
- **cloudflare:** only allows requests from cloudflare ips
    - ips in the `exclude` array are still allowed
- **proxy:** only accepts requests from one ip
    - to disable, set to `false` or `null`
    - to enable, set to a string containing the desired proxy ip
    - the `X-Real-IP` header is used to determine the source ip for rate limits
    - ips in the `exclude` array are still allowed, but cannot set `X-Real-IP` header
- **exclude:** ips that bypass rate limits and other filters
