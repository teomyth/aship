import { type Command, Help, type Interfaces } from '@oclif/core';
import chalk from 'chalk';

export default class CustomHelp extends Help {
  constructor(config: Interfaces.Config, opts?: Partial<Interfaces.HelpOptions>) {
    super(config, opts);

    // Force enable colors for chalk
    chalk.level = 3;
    process.env.FORCE_COLOR = '1';
  }

  protected formatRoot(): string {
    const help = super.formatRoot();

    // Add default command information
    const defaultCommandInfo = this.formatDefaultCommandInfo();

    // Insert default command info after the description but before usage
    const lines = help.split('\n');
    const usageIndex = lines.findIndex(line => line.includes('USAGE'));

    if (usageIndex > 0) {
      lines.splice(usageIndex, 0, '', defaultCommandInfo);
    }

    return lines.join('\n');
  }

  private formatDefaultCommandInfo(): string {
    const title = chalk.yellow('Default Command: ') + chalk.cyan('run');
    const content = `When no command is specified, the ${chalk.cyan('"run"')} command is executed automatically.
For example, ${chalk.cyan('aship setup')} is equivalent to ${chalk.cyan('aship run setup')}.`;

    return this.formatSection(title, content);
  }

  private formatSection(title: string, content: string): string {
    return `${title}\n  ${content}`;
  }

  protected formatCommand(command: Command.Loadable): string {
    const help = super.formatCommand(command);

    // Add enhanced formatting for the run command
    if (command.id === 'run') {
      const additionalInfo = this.formatRunCommandInfo();
      return `${help}\n${additionalInfo}`;
    }

    return help;
  }

  private formatRunCommandInfo(): string {
    const notes = `${chalk.yellow('Note: ')}All ansible-playbook options are supported and passed through.\nFor complete ansible-playbook options, run: ${chalk.cyan('ansible-playbook --help')}`;

    return this.formatSection('Additional Information', notes);
  }
}
