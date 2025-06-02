import fs from 'node:fs';
import path from 'node:path';
import { ConfigurationManager, logger } from '@aship/core';
import { Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';

export default class Init extends Command {
  static override description = 'Initialize a new Aship project with interactive setup';

  static override aliases = ['initialize', 'setup'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --yes',
    '<%= config.bin %> <%= command.id %> --minimal',
  ];

  static override flags = {
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip prompts and use defaults',
      default: false,
    }),
    minimal: Flags.boolean({
      description: 'Create minimal configuration without playbook definitions',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Init);

    try {
      const currentDir = process.cwd();
      const configPath = path.join(currentDir, 'aship.yml');

      // Check if configuration already exists
      if (fs.existsSync(configPath)) {
        if (!flags.yes) {
          const { overwrite } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'overwrite',
              message: 'aship.yml already exists. Do you want to overwrite it?',
              default: false,
            },
          ]);
          if (!overwrite) {
            logger.info('Initialization cancelled.');
            return;
          }
        }
      }

      let projectConfig: any = {};

      if (flags.yes) {
        // Use defaults
        const projectName = path.basename(currentDir);
        projectConfig = {
          name: projectName,
          description: `Ansible project: ${projectName}`,
        };

        if (!flags.minimal) {
          projectConfig.playbooks = {
            site: 'site.yml',
          };
          projectConfig.vars = {
            environment: {
              type: 'choice',
              description: 'Deployment environment',
              choices: ['development', 'staging', 'production'],
              default: 'development',
              required: true,
            },
          };
        }
      } else {
        // Interactive setup
        const questions: any[] = [
          {
            type: 'input',
            name: 'name',
            message: 'Project name:',
            default: path.basename(currentDir),
            validate: (input: string) => (input.trim() ? true : 'Project name is required'),
          },
          {
            type: 'input',
            name: 'description',
            message: 'Project description:',
            default: (answers: any) => `Ansible project: ${answers.name}`,
          },
        ];

        if (!flags.minimal) {
          questions.push(
            {
              type: 'input',
              name: 'mainPlaybook',
              message: 'Main playbook file:',
              default: 'site.yml',
            },
            {
              type: 'confirm',
              name: 'addVariables',
              message: 'Add sample variable definitions?',
              default: true,
            }
          );
        }

        const answers = await inquirer.prompt(questions);

        projectConfig = {
          name: answers.name,
          description: answers.description,
        };

        if (!flags.minimal) {
          projectConfig.playbooks = {
            site: answers.mainPlaybook,
          };

          if (answers.addVariables) {
            projectConfig.vars = {
              environment: {
                type: 'choice',
                description: 'Deployment environment',
                choices: ['development', 'staging', 'production'],
                default: 'development',
                required: true,
              },
              app_name: {
                type: 'string',
                description: 'Application name',
                default: answers.name,
                required: true,
              },
              app_port: {
                type: 'int',
                description: 'Application port',
                default: 8080,
                required: false,
                min: 1000,
                max: 65535,
              },
            };
          }
        }
      }

      // Save configuration
      const configManager = new ConfigurationManager(configPath);
      await configManager.saveConfig(projectConfig);

      logger.success('Aship project initialized successfully!');
      console.log('');
      console.log(`Configuration saved to: ${configPath}`);

      if (!flags.minimal && projectConfig.playbooks) {
        console.log('');
        console.log('Next steps:');
        console.log(`  1. Create your playbook: ${projectConfig.playbooks.site}`);
        console.log('  2. Add hosts: aship host add');
        console.log('  3. Run your playbook: aship site');
      }
    } catch (error) {
      logger.error(
        `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`
      );
      this.exit(1);
    }
  }
}
