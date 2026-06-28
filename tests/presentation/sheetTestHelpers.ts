import request from "supertest";
import type { Application } from "express";

/**
 * Helpers partagés des tests d'intégration HTTP des fiches de personnage (modèle « une fiche =
 * une campagne »).
 *
 * Depuis le refactor, créer une fiche exige une `campaignId` **obligatoire** : un joueur crée sa
 * fiche en choisissant une campagne (statut PENDING), puis le MJ de cette campagne valide
 * (ACCEPTED) ou refuse (suppression). Le joueur ne peut PAS être le MJ de la campagne choisie.
 *
 * Ces helpers encapsulent ce câblage (créer un MJ tiers, le promouvoir MJ, lui faire créer une
 * campagne, créer la fiche) pour garder les tests lisibles.
 */

export type Agent = ReturnType<typeof request.agent>;

/** Agent supertest enrichi de l'identifiant de l'utilisateur qu'il représente. */
export interface AuthedAgent {
  readonly agent: Agent;
  readonly userId: string;
}

/** Inscrit un utilisateur et renvoie un agent supertest conservant ses cookies de session. */
export async function authenticate(
  app: Application,
  email: string,
  pseudo = "Gandalf",
): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post("/auth/register").send({ email, pseudo, password: "password123" });
  return agent;
}

/** Comme {@link authenticate}, mais expose aussi le `userId` (issu de la réponse d'inscription). */
export async function authenticateWithId(
  app: Application,
  email: string,
  pseudo = "Gandalf",
): Promise<AuthedAgent> {
  const agent = request.agent(app);
  const res = await agent.post("/auth/register").send({ email, pseudo, password: "password123" });
  return { agent, userId: res.body.userId as string };
}

/** Crée un groupe (créateur = ADMIN/membre) et renvoie son ID. */
export async function createGroup(agent: Agent, name = "Mon groupe"): Promise<string> {
  const res = await agent.post("/groups").send({ name });
  return res.body.id as string;
}

/**
 * Fait entrer `invitee` dans le groupe `groupId` : `inviter` (admin du groupe) invite par email,
 * `invitee` accepte. Les deux deviennent alors membres du même groupe.
 */
export async function joinGroup(
  inviter: Agent,
  groupId: string,
  invitee: Agent,
  inviteeEmail: string,
): Promise<void> {
  const inv = await inviter.post(`/groups/${groupId}/invitations`).send({ email: inviteeEmail });
  await invitee.post(`/invitations/${inv.body.invitationId}/accept`);
}

/** Crée une campagne dans le groupe `groupId` (le `gm` doit être ADMIN ou MJ) et renvoie son ID. */
export async function createCampaign(
  gm: Agent,
  groupId: string,
  name = "Ma campagne",
): Promise<string> {
  const res = await gm.post("/campaigns").send({ name, groupId });
  return res.body.id as string;
}

/** Compteur monotone pour générer des e-mails de MJ uniques par appel. */
let mjCounter = 0;

/**
 * Provisionne, dans le groupe `groupId` administré par `owner`, une campagne tenue par un **MJ
 * tiers** fraîchement inscrit (distinct du `owner`, pour respecter « le MJ ne joue pas chez lui »).
 *
 * Le MJ est invité dans le groupe puis **promu au rôle MJ** par le `owner` (admin), afin de pouvoir
 * créer une campagne (réservé aux ADMIN/MJ).
 *
 * @returns L'identifiant de la campagne et l'agent du MJ (pour valider/refuser les demandes).
 */
export async function provisionCampaignWithMj(
  app: Application,
  owner: Agent,
  groupId: string,
  campaignName = "Campagne du MJ",
): Promise<{ campaignId: string; mj: Agent; mjUserId: string }> {
  mjCounter += 1;
  const mjEmail = `mj-helper-${mjCounter}@test.com`;
  const { agent: mj, userId: mjUserId } = await authenticateWithId(app, mjEmail, "MJ");
  await joinGroup(owner, groupId, mj, mjEmail);
  // Promotion au rôle MJ (par l'admin du groupe) : requis pour créer une campagne.
  await owner.patch(`/groups/${groupId}/members/${mjUserId}`).send({ role: "MJ" });
  const campaignId = await createCampaign(mj, groupId, campaignName);
  return { campaignId, mj, mjUserId };
}

/**
 * Crée une fiche PENDING possédée par `owner` dans le groupe `groupId`, en provisionnant au passage
 * une campagne tenue par un MJ tiers (cf. {@link provisionCampaignWithMj}).
 *
 * @returns La fiche créée (corps de la réponse 201), la `campaignId` et l'agent du MJ.
 */
export async function createPendingSheet(
  app: Application,
  owner: Agent,
  groupId: string,
  name = "Aragorn",
): Promise<{
  sheet: { id: string; ownerId: string; name: string };
  campaignId: string;
  mj: Agent;
}> {
  const { campaignId, mj } = await provisionCampaignWithMj(app, owner, groupId);
  const res = await owner.post("/character-sheets").send({ name, groupId, campaignId });
  return { sheet: res.body, campaignId, mj };
}
