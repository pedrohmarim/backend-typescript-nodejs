const limit = "limit=100";

const baseUrl = (channelId: string) =>
  `https://discord.com/api/v9/channels/${channelId}/messages?${limit}`;

export default baseUrl;
