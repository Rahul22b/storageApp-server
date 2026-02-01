


export const verifygitIdToken=async (code) => {
    // Exchange code for access token
    // console.log(code);
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { 
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  });

  const { access_token } = await tokenResponse.json();

  // Fetch user profile
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  const user = await userResponse.json();

  // Fetch REAL email
const emailResponse = await fetch("https://api.github.com/user/emails", {
  headers: {
    Authorization: `Bearer ${access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "storage-app"
  }
});


  const emails = await emailResponse.json();
  console.log(emails);
  const primaryEmailObj = emails.find(email => email.primary) || emails[0];
  const primaryEmail = primaryEmailObj ? primaryEmailObj.email : null;

  // Build YOUR clean user object
  const userData = { 
    id: user.id,
    username: user.login,
    name: user.name || user.login,
    email: primaryEmail,
    avatar: user.avatar_url
  };
  return userData;
}
