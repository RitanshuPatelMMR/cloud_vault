"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query, ID } from "node-appwrite";
import { parseStringify } from "@/lib/utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { avatarPlaceholderUrl } from "@/constants";

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])],
  );

  return result.total > 0 ? result.documents[0] : null;
};

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const generatePassword = () => Math.random().toString(36).slice(-10) + "A1!";

// For SIGN UP only - creates NEW user
export const sendEmailOTPForSignUp = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const password = generatePassword();

    // Create new auth user
    const user = await account.create(ID.unique(), email, password);

    // Send Email OTP
    await account.createEmailToken(ID.unique(), email);

    return user.$id;
  } catch (error) {
    handleError(error, "Failed to send email OTP for sign up");
  }
};

// For SIGN IN only - just sends OTP to existing user
export const sendEmailOTPForSignIn = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    // Just send OTP token - don't create new user
    await account.createEmailToken(ID.unique(), email);
    return true;
  } catch (error) {
    handleError(error, "Failed to send email OTP for sign in");
  }
};

export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);

  // If user exists, return error
  if (existingUser) {
    return parseStringify({
      accountId: null,
      error: "User already exists. Please sign in.",
    });
  }

  // Create new user and send OTP
  const accountId = await sendEmailOTPForSignUp({ email });
  if (!accountId) throw new Error("Failed to send an OTP");

  // Create database document
  const { databases } = await createAdminClient();

  await databases.createDocument(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    ID.unique(),
    {
      fullName,
      email,
      avatar: avatarPlaceholderUrl,
      accountId,
    },
  );

  return parseStringify({ accountId });
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createSession(accountId, password);

    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  try {
    const { databases, account } = await createSessionClient();

    const result = await account.get();

    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", result.$id)],
    );

    if (user.total <= 0) return null;

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error);
  }
};

export const signOutUser = async () => {
  const { account } = await createSessionClient();

  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);

    // User NOT found
    if (!existingUser) {
      return parseStringify({
        accountId: null,
        error: "User not found. Please sign up first.",
      });
    }

    // Send OTP to existing user's email
    await sendEmailOTPForSignIn({ email });

    return parseStringify({ accountId: existingUser.accountId });
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};
