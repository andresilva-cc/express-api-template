import { nanoid } from 'nanoid';
import MailService from './MailService';
import { BadRequestError, EmailAlreadyInUseError } from '../Errors';
import { PasswordFacade } from '../Facades';
import { UserActivatedMail, UserRegisteredMail } from '../Mail';
import { User } from '../Models';
import { userRepository, userActivationRepository } from '../Repositories';

export default class AuthService {
  public static async register(name: string, email: string, password: string): Promise<void> {
    if (await userRepository.emailExists(email)) {
      throw new EmailAlreadyInUseError();
    }

    const user = await userRepository.create({
      name,
      email,
      password: PasswordFacade.hash(password),
    });

    this.createUserActivation(user as User);
  }

  public static async activate(token: string): Promise<void> {
    const activation = await userActivationRepository.findByToken(token);

    if (!activation) {
      throw new BadRequestError();
    }

    // @ts-ignore
    await userRepository.update(activation.user.id, {
      active: true,
    });

    // @ts-ignore
    await userActivationRepository.delete(activation.userId);

    // @ts-ignore
    AuthService.sendUserActivatedMail(activation.user as User);
  }

  private static async createUserActivation(user: User): Promise<void> {
    let token;
    let activationExists;

    // TODO: Find a better way to do this without await in loop
    do {
      token = nanoid(21);
      // eslint-disable-next-line no-await-in-loop
      activationExists = await userActivationRepository.findByToken(token);
    } while (activationExists);

    await userActivationRepository.create({
      userId: user.id,
      token,
    });

    AuthService.sendUserRegisteredMail(user, token);
  }

  private static sendUserRegisteredMail(user: User, token: string) {
    MailService.send(new UserRegisteredMail(user.name, user.email, token).build());
  }

  private static sendUserActivatedMail(user: User) {
    MailService.send(new UserActivatedMail(user.name, user.email).build());
  }
}
