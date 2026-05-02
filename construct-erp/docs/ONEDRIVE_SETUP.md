ONEDRIVE INTEGRATION SETUP GUIDE
ConstructERP — Document Storage
=================================
Date: 17 April 2026
Version: 1.0


OVERVIEW
--------
The Documents module in ConstructERP uses Microsoft OneDrive (via Microsoft
Graph API) to store uploaded files. Files are uploaded to the OneDrive account
of a designated Microsoft 365 user under the folder:

    Documents/ConstructERP/{Project}/{Module}/{filename}

If OneDrive is not configured, files are still saved locally on the server
(backend/uploads/documents/) and the system continues to work normally.


PRE-REQUISITES
--------------
- A Microsoft 365 or Azure subscription
- Admin access to the Azure portal (portal.azure.com)
- A Microsoft 365 user account whose OneDrive will store the files
  (usually the company admin: e.g. admin@yourcompany.onmicrosoft.com)


STEP 1 — REGISTER AN APP IN AZURE
-----------------------------------
1. Open your browser and go to:
       https://portal.azure.com

2. Sign in with your Microsoft account.

3. In the top search bar, type "App registrations" and click the result.

4. Click "New registration" (top left button).

5. Fill in the form:
       Name                  : ConstructERP-OneDrive
       Supported account types: Accounts in this organizational directory only
                                (Single tenant)
       Redirect URI          : Leave blank

6. Click the "Register" button.

7. You will be taken to the app overview page. KEEP THIS PAGE OPEN.


STEP 2 — COPY YOUR CREDENTIALS
--------------------------------
On the app overview page, you will see two important values. Copy both:

   Application (client) ID  →  This becomes ONEDRIVE_CLIENT_ID
   Directory (tenant) ID    →  This becomes ONEDRIVE_TENANT_ID

Save these in a notepad for now. You will add them to the .env file in Step 5.

Application (client) ID
8381e11d-5f7c-4385-8826-9cdef321a1f9

Directory (tenant) ID
3ddc10b3-ccde-4f72-ac20-83f9084b0794



STEP 3 — CREATE A CLIENT SECRET
---------------------------------
1. In the left sidebar of your app page, click "Certificates & secrets".

2. Click the tab "Client secrets".

3. Click "New client secret".

4. Fill in:
       Description : erp-secret
       Expires     : 24 months (recommended)

5. Click "Add".

6. A new row appears with a "Value" column.
   IMPORTANT: Copy this value IMMEDIATELY.
   Microsoft hides it permanently after you leave this page.

value: YOUR_CLIENT_SECRET_VALUE_HERE
secret_id: YOUR_SECRET_ID_HERE

   This value becomes ONEDRIVE_CLIENT_SECRET.


STEP 4 — GRANT API PERMISSIONS
--------------------------------
1. In the left sidebar, click "API permissions".

2. Click "Add a permission".

3. In the panel that opens, click "Microsoft Graph".

4. Click "Application permissions" (NOT Delegated permissions).

5. In the search box, type: Files.ReadWrite.All

6. Check the checkbox next to "Files.ReadWrite.All".

7. Click "Add permissions" at the bottom.

8. You will now see "Files.ReadWrite.All" in the list with a warning icon.

9. Click the button "Grant admin consent for [Your Organization]".
   (This button is above the permissions list.)

10. Click "Yes" to confirm.

    The warning icon should change to a green checkmark.
    Status should read: "Granted for [Your Organization]"

NOTE: If you do not see the "Grant admin consent" button, you do not have
      Global Administrator rights. Ask your IT administrator to do this step.


STEP 5 — ADD CREDENTIALS TO THE .ENV FILE
-------------------------------------------
Open the file located at:

    construct-erp/backend/.env

Add the following four lines at the bottom of the file:

    ONEDRIVE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ONEDRIVE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    ONEDRIVE_CLIENT_SECRET=your-secret-value-from-step-3
    ONEDRIVE_USER_EMAIL=admin@yourcompany.onmicrosoft.com

Replace each value with the actual values you copied in Steps 2 and 3.

ONEDRIVE_USER_EMAIL must be the Microsoft 365 email address of the user
whose OneDrive account will be used for file storage. This is typically
your company admin account.

Example (do not use these values — they are fake):

    ONEDRIVE_TENANT_ID=3f4a8b21-dc90-4e12-bf33-1a9c4d72e001
    ONEDRIVE_CLIENT_ID=8b2c1d33-aa01-4f78-9321-cc44de901234
    ONEDRIVE_CLIENT_SECRET=Xy8~Q3rTzK.mN7pLwB2vCjA0sD6fE1gH
    ONEDRIVE_USER_EMAIL=admin@bcimengineering.onmicrosoft.com


STEP 6 — RESTART THE BACKEND SERVER
--------------------------------------
Stop your running backend server (Ctrl + C in the terminal), then start it again:

    cd construct-erp/backend
    npm run dev

The server will print the following line if OneDrive is configured correctly:

    ✅ OneDrive integration configured


STEP 7 — TEST THE INTEGRATION
-------------------------------
1. Open the ERP in your browser and log in.

2. Go to: Documents (in the left sidebar).

3. Click "Upload Document".

4. Select any file and choose a project and module.

5. Click Upload.

6. After upload, the Documents table should show a "View in OneDrive" link
   in the OneDrive column.

7. Click the link — it should open the file directly in OneDrive/Office Online.

To also verify from the backend terminal, you should see a log line like:

    ✅ OneDrive upload successful: YourFileName.pdf


TROUBLESHOOTING
---------------
Problem : OneDrive column shows "Local only" after upload.
Solution: The .env file values are missing or incorrect. Double-check all
          four variables are present and have no extra spaces or quotes.

Problem : Backend shows error "Insufficient privileges to complete the operation"
Solution: Admin consent was not granted in Step 4. Ask your Azure admin to
          grant consent for Files.ReadWrite.All.

Problem : Error "Application not found in the directory"
Solution: The ONEDRIVE_TENANT_ID is wrong. Re-copy it from the Azure app
          overview page.

Problem : Error "Invalid client secret"
Solution: The ONEDRIVE_CLIENT_SECRET was copied incorrectly or has expired.
          Go to Azure → App registrations → your app → Certificates & secrets
          → create a new secret and update the .env file.

Problem : Files upload but go to the wrong OneDrive account.
Solution: Check ONEDRIVE_USER_EMAIL matches the correct Microsoft 365 user.


FILE STORAGE STRUCTURE IN ONEDRIVE
------------------------------------
All files are organized automatically under the root Documents folder:

    OneDrive (of ONEDRIVE_USER_EMAIL)
    └── Documents/
        └── ConstructERP/
            ├── Skyline Heights Project/
            │   ├── purchase_order/
            │   │   └── PO-2025-001.pdf
            │   ├── grn/
            │   │   └── GRN-2025-089-receipt.jpg
            │   └── ra_bill/
            │       └── RABill-March-2025.pdf
            └── NH-48 Highway Project/
                └── hse/
                    └── SafetyAuditReport.pdf


ENVIRONMENT VARIABLES SUMMARY
-------------------------------
Variable               Description
--------------------   --------------------------------------------------------
ONEDRIVE_TENANT_ID     Azure Directory (tenant) ID — from app overview page
ONEDRIVE_CLIENT_ID     Azure Application (client) ID — from app overview page
ONEDRIVE_CLIENT_SECRET Client secret value — from Certificates & secrets tab
ONEDRIVE_USER_EMAIL    Microsoft 365 email whose OneDrive stores the files


SECURITY NOTES
--------------
- Never commit the .env file to Git. It is already listed in .gitignore.
- Rotate the client secret every 24 months before it expires.
- The app uses "Application permissions" (app-only), meaning it does not
  require a user to be logged in to upload files — the backend handles it.
- Only give this app Files.ReadWrite.All — do not add other permissions.


SUPPORT
-------
If you need help, contact your system administrator or refer to the
Microsoft Graph API documentation at:

    https://learn.microsoft.com/en-us/graph/api/driveitem-put-content


=================================
END OF DOCUMENT
ConstructERP — BCIM Engineering
=================================
