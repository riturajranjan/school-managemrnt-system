import type { Guardian, ParentAccount } from "@/lib/types/students";
import { cities, firstNamesFemale, firstNamesMale, fullName, lastNames, occupations, organizations } from "./names";
import { seededHelpers } from "./rng";

export type GuardianPair = { father: Guardian; mother: Guardian };

const helpers = seededHelpers(20260805);

export function makeGuardianPair(index: number, sharedLastName: string): GuardianPair {
  const { pick, int, bool } = helpers;
  const location = pick(cities);
  const phoneBase = 7000000000 + index * 37;

  const father: Guardian = {
    id: `guardian-${index}-f`,
    firstName: pick(firstNamesMale),
    lastName: sharedLastName,
    occupation: pick(occupations),
    organization: pick(organizations),
    contact: {
      email: `${sharedLastName.toLowerCase()}.father${index}@example.com`,
      phone: `+91 ${String(phoneBase).slice(0, 5)} ${String(phoneBase).slice(5)}`,
    },
    address: {
      line1: `${int(1, 200)}, ${pick(["MG Road", "Lake View Layout", "Palm Meadows", "Church Street", "Cross Street"])}`,
      city: location.city,
      state: location.state,
      postalCode: `${int(560001, 560103)}`,
      country: "India",
    },
    communicationPreference: bool(0.6) ? "whatsapp" : "email",
  };

  const motherPhoneBase = phoneBase + 11;
  const mother: Guardian = {
    id: `guardian-${index}-m`,
    firstName: pick(firstNamesFemale),
    lastName: sharedLastName,
    occupation: bool(0.7) ? pick(occupations) : undefined,
    organization: bool(0.7) ? pick(organizations) : undefined,
    contact: {
      email: `${sharedLastName.toLowerCase()}.mother${index}@example.com`,
      phone: `+91 ${String(motherPhoneBase).slice(0, 5)} ${String(motherPhoneBase).slice(5)}`,
    },
    address: father.address,
    communicationPreference: bool(0.6) ? "whatsapp" : "sms",
  };

  return { father, mother };
}

export function randomLastName(): string {
  return helpers.pick(lastNames);
}

export function makeParentAccount(guardian: Guardian, index: number): ParentAccount {
  const { pick, bool, daysAgoIso } = helpers;
  const status = pick(["active", "active", "invited", "not-invited", "suspended"] as const);
  return {
    id: `parent-${guardian.id}`,
    guardianId: guardian.id,
    portalStatus: status,
    invitedAt: status !== "not-invited" ? daysAgoIso(60 + index) : undefined,
    lastLoginAt: status === "active" ? daysAgoIso(index % 14) : undefined,
    loginHistory:
      status === "active"
        ? [
            { id: `login-${guardian.id}-1`, at: daysAgoIso(index % 14), device: "iPhone · Safari", ip: "49.204.11.2" },
            { id: `login-${guardian.id}-2`, at: daysAgoIso((index % 14) + 9), device: "Chrome · Windows", ip: "49.204.11.2" },
          ]
        : [],
    consentForms: [
      { id: `consent-${guardian.id}-photo`, title: "Photo & media consent", status: bool(0.8) ? "signed" : "pending", signedAt: bool(0.8) ? daysAgoIso(120) : undefined },
      { id: `consent-${guardian.id}-trip`, title: "Field trip consent", status: bool(0.6) ? "signed" : "pending", signedAt: bool(0.6) ? daysAgoIso(30) : undefined },
    ],
  };
}

export { fullName };
