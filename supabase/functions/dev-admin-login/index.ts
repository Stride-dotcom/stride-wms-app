import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dev admin user credentials
const DEV_ADMIN_EMAIL = "admin-dev@dev.local";
const DEV_ADMIN_PASSWORD = "devadmin123!";
const ADMIN_DEV_ROLE_ID = "a0000000-0000-0000-0000-000000000001";
// Demo tenant ID for admin-dev user (required for app to function)
const DEMO_TENANT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Edge function to provision and sign in a dev admin user.
 *
 * This function:
 * 1. Only works in development mode (VITE_ENABLE_DEV_QUICK_LOGIN=true)
 * 2. Creates the admin-dev@dev.local user if it doesn't exist
 * 3. Assigns the admin_dev system role
 * 4. Returns session credentials for the user
 *
 * SECURITY: This function should NEVER be deployed to production.
 */
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if dev mode is enabled
    const devModeEnabled = Deno.env.get("VITE_ENABLE_DEV_QUICK_LOGIN") === "true" ||
                           Deno.env.get("DEV_MODE") === "true";

    if (!devModeEnabled) {
      return new Response(
        JSON.stringify({ error: "Dev login is disabled in this environment" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Step 1: Check if user exists
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      throw new Error(`Failed to list users: ${listError.message}`);
    }

    let userId: string;
    const existingUser = existingUsers.users.find(u => u.email === DEV_ADMIN_EMAIL);

    if (existingUser) {
      userId = existingUser.id;
      console.log(`Found existing dev admin user: ${userId}`);
      
      // Ensure profile exists for existing user (might be missing due to previous RLS issues)
      const { error: profileError } = await adminClient
        .from('users')
        .upsert({
          id: userId,
          email: DEV_ADMIN_EMAIL,
          password_hash: 'supabase_auth_managed',
          first_name: 'Admin',
          last_name: 'Dev',
          status: 'active',
          tenant_id: DEMO_TENANT_ID,
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.warn(`Note: Could not ensure user profile: ${profileError.message}`);
      } else {
        console.log(`Ensured user profile exists for ${userId}`);
      }
    } else {
      // Step 2: Create the user if doesn't exist
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: DEV_ADMIN_EMAIL,
        password: DEV_ADMIN_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: "Admin",
          last_name: "Dev",
        },
      });

      if (createError) {
        throw new Error(`Failed to create user: ${createError.message}`);
      }

      userId = newUser.user.id;
      console.log(`Created new dev admin user: ${userId}`);

      // Create user profile in users table with demo tenant
      const { error: profileError } = await adminClient
        .from('users')
        .upsert({
          id: userId,
          email: DEV_ADMIN_EMAIL,
          password_hash: 'supabase_auth_managed',
          first_name: 'Admin',
          last_name: 'Dev',
          status: 'active',
          tenant_id: DEMO_TENANT_ID, // Use demo tenant for app access
        }, {
          onConflict: 'id',
        });

      if (profileError) {
        console.warn(`Note: Could not create user profile: ${profileError.message}`);
        // Don't fail - user profile might be created by trigger
      } else {
        console.log(`Created user profile for ${userId} with tenant ${DEMO_TENANT_ID}`);
      }
    }

    // Step 3: Ensure admin_dev role is assigned
    // First check if role exists
    const { data: role, error: roleError } = await adminClient
      .from('roles')
      .select('id')
      .eq('id', ADMIN_DEV_ROLE_ID)
      .maybeSingle();

    if (roleError || !role) {
      // Try to find by name as fallback
      const { data: roleByName } = await adminClient
        .from('roles')
        .select('id')
        .eq('name', 'admin_dev')
        .eq('is_system', true)
        .maybeSingle();

      if (!roleByName) {
        throw new Error('admin_dev role not found in database');
      }
    }

    const roleId = role?.id || ADMIN_DEV_ROLE_ID;

    // Check if user already has the role
    const { data: existingRole } = await adminClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role_id', roleId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!existingRole) {
      // Assign the admin_dev role
      const { error: assignError } = await adminClient
        .from('user_roles')
        .insert({
          user_id: userId,
          role_id: roleId,
        });

      if (assignError) {
        console.warn(`Note: Could not assign role: ${assignError.message}`);
        // Don't fail - might be RLS issue but user can still sign in
      } else {
        console.log(`Assigned admin_dev role to user ${userId}`);
      }
    }

    // Step 4: Sign in the user and return session
    const { data: signInData, error: signInError } = await adminClient.auth.signInWithPassword({
      email: DEV_ADMIN_EMAIL,
      password: DEV_ADMIN_PASSWORD,
    });

    if (signInError) {
      throw new Error(`Failed to sign in: ${signInError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        session: signInData.session,
        user: {
          id: signInData.user?.id,
          email: signInData.user?.email,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error in dev-admin-login:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
