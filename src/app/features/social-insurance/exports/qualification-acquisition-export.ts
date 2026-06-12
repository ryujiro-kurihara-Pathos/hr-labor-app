import { Company } from '../../company/models/company.model';
import { Office } from '../../company/models/office.model';
import { Employee } from '../../employee/models/employee.models';
import { Procedure } from '../models/procedures.model';

export type QualificationAcquisitionCsvRow = {
  事業所整理記号: string;
  事業所番号: string;
  事業所所在地: string;
  事業所名称: string;
  事業主氏名: string;
  電話番号: string;

  被保険者整理番号: string;
  氏名: string;
  フリガナ: string;
  生年月日: string;
  種別: string;
  取得区分: string;

  個人番号登録状況: string;
  資格取得日: string;
  被扶養者の有無: string;

  通貨による報酬月額: number;
  現物による報酬月額: number;
  報酬月額合計: number;

  住所: string;
};

export function createQualificationAcquisitionCsvRow(params: {
  company: Company;
  office: Office;
  employee: Employee;
  procedure: Procedure;
}): QualificationAcquisitionCsvRow {
  const { company, office, employee, procedure } = params;

  const officeAddress = `${office.prefecture}${office.city}${office.streetAddress}`;
  const employeeAddress = `${employee.prefecture}${employee.city}${employee.streetAddress}`;

  return {
    事業所整理記号: office.officeSymbol,
    事業所番号: office.officeNumber,
    事業所所在地: officeAddress,
    事業所名称: office.name,
    事業主氏名: company.representativeName,
    電話番号: office.phoneNumber,

    被保険者整理番号: employee.myNumber ?? '',
    氏名: employee.lastName + ' ' + employee.firstName,
    フリガナ: employee.lastNameKana + ' ' + employee.firstNameKana,
    生年月日: employee.birthDate,
    種別: employee.gender === 'male' ? '男' : '女',
    取得区分: '健保・厚年',

    個人番号登録状況: employee.myNumber ? '登録済み' : '未登録',
    資格取得日: procedure.qualificationDate ?? '',
    被扶養者の有無: procedure.hasDependents ? '有' : '無',

    通貨による報酬月額: procedure.rewardCashAmount ?? 0,
    現物による報酬月額: procedure.rewardInKindAmount ?? 0,
    報酬月額合計: procedure.rewardTotalAmount ?? 0,

    住所: employeeAddress,
  };
}