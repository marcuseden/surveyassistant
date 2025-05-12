# Enabling Twilio International Calling to Sweden

This guide will walk you through the process of enabling international calling permissions for Sweden in your Twilio account.

## Background

You're currently seeing the following error when trying to make calls to Swedish phone numbers:

```
Error initiating call: RestException [Error]: Account not authorized to call +46702216106. Perhaps you need to enable some international permissions: https://www.twilio.com/console/voice/calls/geo-permissions/low-risk
```

This error occurs because Twilio requires explicit permissions to make international calls to protect accounts from potential fraud.

## Steps to Enable Calling to Sweden

1. **Log in to your Twilio Console**
   - Go to [https://console.twilio.com/](https://console.twilio.com/)
   - Sign in with your Twilio account credentials

2. **Navigate to Geographic Permissions**
   - In the left sidebar, click on "Voice"
   - Select "Settings"
   - Click on "Geo Permissions"

3. **Enable Permissions for Sweden**
   - In the country list, find "Sweden (SE)"
   - Check the box under "Low-Risk Number Ranges" to enable calling to standard Swedish numbers
   - Leave "High-Risk Special Services" and "High-Risk Toll Fraud" unchecked unless you specifically need to call those number types

4. **Save Your Changes**
   - Click the "Save" button at the bottom of the page
   - Your changes may take a few minutes to propagate through Twilio's system

5. **Test the Call**
   - Return to your application
   - Try initiating a call to the Swedish number again
   - The call should now connect successfully

## Verification

After enabling permissions, you can test if a specific number is allowed by using the "Check Phone Number" tool in the Geo Permissions page of your Twilio console.

## Important Notes

- Only account owners and administrators can modify Geographic Permissions
- For security reasons, it's best to only enable permissions for countries you actually need to call
- If you still encounter issues after following these steps, contact Twilio support at https://support.twilio.com/

## Additional Resources

- [Twilio Geographic Permissions Documentation](https://www.twilio.com/docs/voice/api/dialing-permissions-resources)
- [Protect your account with Voice Dialing Geographic Permissions](https://www.twilio.com/docs/sip-trunking/voice-dialing-geographic-permissions) 